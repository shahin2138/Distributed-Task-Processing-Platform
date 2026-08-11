import db, { logSystemEvent } from './db.js';
import { broadcast } from './wsServer.js';

/**
 * Helper to match pattern rules against event detail JSON payload.
 * Supports basic key-value matching and nested checks.
 */
function matchPattern(detailPayload, pattern) {
  if (!pattern || Object.keys(pattern).length === 0) return true;
  
  for (const [key, val] of Object.entries(pattern)) {
    if (detailPayload[key] === undefined) return false;
    if (typeof val === 'object' && val !== null) {
      if (!matchPattern(detailPayload[key], val)) return false;
    } else if (detailPayload[key] !== val) {
      return false;
    }
  }
  return true;
}

/**
 * Publish event to EventBridge Bus and route to target queues
 */
export function publishEvent({ bus_id = 'bus-default', source, detail_type, detail }) {
  const eventId = 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  const detailJsonStr = typeof detail === 'string' ? detail : JSON.stringify(detail || {});
  const parsedDetail = typeof detail === 'string' ? JSON.parse(detail) : (detail || {});

  // 1. Insert Event into DB
  const insertEventStmt = db.prepare(`
    INSERT INTO events (id, bus_id, source, detail_type, detail_json, matched_rules_count, status)
    VALUES (?, ?, ?, ?, ?, 0, 'INGESTED')
  `);
  insertEventStmt.run(eventId, bus_id, source, detail_type, detailJsonStr);

  logSystemEvent('EVENTBRIDGE', 'INFO', `Received event [${source} -> ${detail_type}] on bus ${bus_id}`, { eventId });

  // 2. Fetch Active Rules matching source & detail_type
  const rulesStmt = db.prepare(`
    SELECT r.*, q.name as target_queue_name 
    FROM event_rules r
    JOIN queues q ON r.target_queue_id = q.id
    WHERE r.bus_id = ? AND r.event_source = ? AND r.detail_type = ? AND r.is_active = 1
  `);
  const candidateRules = rulesStmt.all(bus_id, source, detail_type);

  let matchedRulesCount = 0;
  const matchedTargetQueues = [];

  // 3. Evaluate candidate rules pattern matching
  for (const rule of candidateRules) {
    let patternObj = {};
    try {
      patternObj = JSON.parse(rule.pattern_json || '{}');
    } catch (e) {
      patternObj = {};
    }

    if (matchPattern(parsedDetail, patternObj)) {
      matchedRulesCount++;
      matchedTargetQueues.push({ queueId: rule.target_queue_id, queueName: rule.target_queue_name, ruleName: rule.name });

      // Enqueue message into target queue
      const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      const enqueueStmt = db.prepare(`
        INSERT INTO queue_messages (id, queue_id, event_id, payload_json, status, retry_count, visible_after)
        VALUES (?, ?, ?, ?, 'PENDING', 0, CURRENT_TIMESTAMP)
      `);
      enqueueStmt.run(msgId, rule.target_queue_id, eventId, detailJsonStr);

      logSystemEvent('QUEUE', 'SUCCESS', `Routed event ${eventId} via rule "${rule.name}" to queue "${rule.target_queue_name}"`, { msgId, queueId: rule.target_queue_id });
    }
  }

  // 4. Update Event status
  const eventStatus = matchedRulesCount > 0 ? 'ROUTED' : 'UNMATCHED';
  const updateEventStmt = db.prepare(`
    UPDATE events SET matched_rules_count = ?, status = ? WHERE id = ?
  `);
  updateEventStmt.run(matchedRulesCount, eventStatus, eventId);

  // Broadcast WebSocket update
  broadcast({
    type: 'EVENT_PUBLISHED',
    data: {
      eventId,
      bus_id,
      source,
      detail_type,
      detail: parsedDetail,
      matchedRulesCount,
      matchedTargetQueues,
      status: eventStatus,
      timestamp: new Date().toISOString()
    }
  });

  return {
    eventId,
    bus_id,
    source,
    detail_type,
    matchedRulesCount,
    matchedTargetQueues,
    status: eventStatus
  };
}
