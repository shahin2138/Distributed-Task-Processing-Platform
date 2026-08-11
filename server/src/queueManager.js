import db, { logSystemEvent } from './db.js';
import { broadcast } from './wsServer.js';

/**
 * Get summary of queues and message counts
 */
export function getQueuesOverview() {
  const stmt = db.prepare(`
    SELECT q.*, 
      COALESCE(SUM(CASE WHEN m.status = 'PENDING' THEN 1 ELSE 0 END), 0) as pending_count,
      COALESCE(SUM(CASE WHEN m.status = 'PROCESSING' THEN 1 ELSE 0 END), 0) as processing_count,
      COALESCE(SUM(CASE WHEN m.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) as completed_count,
      COALESCE(SUM(CASE WHEN m.status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed_count,
      COALESCE(SUM(CASE WHEN m.status = 'DLQ' THEN 1 ELSE 0 END), 0) as dlq_count
    FROM queues q
    LEFT JOIN queue_messages m ON q.id = m.queue_id
    GROUP BY q.id
    ORDER BY q.created_at ASC
  `);
  return stmt.all();
}

/**
 * Dequeue next available message from queue (atomic lock)
 */
export function dequeueMessage(queueId, workerId) {
  // Fetch queue visibility timeout config
  const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(queueId);
  const visibilitySec = queue ? queue.visibility_timeout_sec : 10;

  let msg = null;

  // Use a transaction for atomic read-and-lock
  const transaction = db.transaction(() => {
    // Find oldest pending message that is currently visible
    const selectStmt = db.prepare(`
      SELECT * FROM queue_messages 
      WHERE queue_id = ? 
        AND status = 'PENDING' 
        AND visible_after <= CURRENT_TIMESTAMP
      ORDER BY created_at ASC 
      LIMIT 1
    `);
    const candidate = selectStmt.get(queueId);

    if (candidate) {
      const updateStmt = db.prepare(`
        UPDATE queue_messages 
        SET status = 'PROCESSING',
            locked_by_worker = ?,
            visible_after = datetime('now', '+' || ? || ' seconds'),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run(workerId, visibilitySec, candidate.id);
      msg = candidate;
    }
  });

  transaction();

  if (msg) {
    logSystemEvent('QUEUE', 'INFO', `Worker [${workerId}] dequeued message [${msg.id}] from [${queueId}]`, { msgId: msg.id, queueId });
    broadcast({ type: 'MESSAGE_DEQUEUED', data: { queueId, workerId, msgId: msg.id } });
  }

  return msg;
}

/**
 * Acknowledge message completion (ACK)
 */
export function ackMessage(msgId, workerId) {
  const stmt = db.prepare(`
    UPDATE queue_messages 
    SET status = 'COMPLETED', locked_by_worker = NULL, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(msgId);

  logSystemEvent('QUEUE', 'SUCCESS', `Worker [${workerId}] completed message [${msgId}] (ACK)`, { msgId });
  broadcast({ type: 'MESSAGE_COMPLETED', data: { msgId, workerId } });
}

/**
 * Reject message failure (NACK) - handle retry backoff or move to DLQ
 */
export function nackMessage(msgId, workerId, errorMessage = 'Execution Error') {
  const msg = db.prepare('SELECT m.*, q.max_retries FROM queue_messages m JOIN queues q ON m.queue_id = q.id WHERE m.id = ?').get(msgId);

  if (!msg) return;

  const newRetryCount = msg.retry_count + 1;

  if (newRetryCount >= msg.max_retries) {
    // Exceeded maximum retries -> Move to Dead Letter Queue
    const transaction = db.transaction(() => {
      // 1. Mark status as DLQ
      db.prepare(`UPDATE queue_messages SET status = 'DLQ', error_message = ?, locked_by_worker = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(errorMessage, msgId);

      // 2. Insert into dead_letter_queue record
      const dlqId = 'dlq-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      db.prepare(`
        INSERT INTO dead_letter_queue (id, original_message_id, original_queue_id, payload_json, fail_reason, retry_attempts, status)
        VALUES (?, ?, ?, ?, ?, ?, 'UNRESOLVED')
      `).run(dlqId, msgId, msg.queue_id, msg.payload_json, errorMessage, newRetryCount);
    });

    transaction();

    logSystemEvent('DLQ', 'ERROR', `Message [${msgId}] exceeded max retries (${msg.max_retries}). Moved to Dead Letter Queue!`, { msgId, queueId: msg.queue_id, failReason: errorMessage });
    broadcast({ type: 'MESSAGE_MOVED_TO_DLQ', data: { msgId, queueId: msg.queue_id, errorMessage } });
  } else {
    // Retry with backoff lock delay (5s * retryCount)
    const delaySec = 3 * newRetryCount;
    db.prepare(`
      UPDATE queue_messages 
      SET status = 'PENDING', 
          retry_count = ?, 
          error_message = ?, 
          locked_by_worker = NULL, 
          visible_after = datetime('now', '+' || ? || ' seconds'),
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newRetryCount, errorMessage, delaySec, msgId);

    logSystemEvent('QUEUE', 'WARN', `Worker [${workerId}] failed message [${msgId}]. Retry #${newRetryCount}/${msg.max_retries} scheduled in ${delaySec}s`, { msgId, retryCount: newRetryCount });
    broadcast({ type: 'MESSAGE_RETRY_SCHEDULED', data: { msgId, retryCount: newRetryCount, delaySec } });
  }
}

/**
 * Re-drive a Dead Letter Queue (DLQ) message back to its original queue
 */
export function redriveDLQMessage(dlqId) {
  const dlqRecord = db.prepare('SELECT * FROM dead_letter_queue WHERE id = ?').get(dlqId);
  if (!dlqRecord) throw new Error('DLQ record not found');

  const newMsgId = 'msg-redrive-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

  const transaction = db.transaction(() => {
    // 1. Mark DLQ entry as REDRIVEN
    db.prepare(`UPDATE dead_letter_queue SET status = 'REDRIVEN' WHERE id = ?`).run(dlqId);

    // 2. Re-enqueue message into original queue
    db.prepare(`
      INSERT INTO queue_messages (id, queue_id, payload_json, status, retry_count, visible_after)
      VALUES (?, ?, ?, 'PENDING', 0, CURRENT_TIMESTAMP)
    `).run(newMsgId, dlqRecord.original_queue_id, dlqRecord.payload_json);
  });

  transaction();

  logSystemEvent('DLQ', 'SUCCESS', `Re-driven DLQ item [${dlqId}] back to queue [${dlqRecord.original_queue_id}] as [${newMsgId}]`, { dlqId, newMsgId });
  broadcast({ type: 'DLQ_REDRIVEN', data: { dlqId, newMsgId, queueId: dlqRecord.original_queue_id } });

  return { success: true, newMsgId };
}
