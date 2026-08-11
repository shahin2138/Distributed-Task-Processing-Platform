import db, { logSystemEvent } from './db.js';
import { dequeueMessage, ackMessage, nackMessage } from './queueManager.js';
import { broadcast } from './wsServer.js';

let isPoolRunning = false;
let poolInterval = null;
let simulatedFailureRate = 0.15; // 15% artificial failure rate for testing retries & DLQ
let processingDelayMs = 1200;    // 1.2s execution time simulation

/**
 * Start worker loop
 */
export function startWorkerPool() {
  if (isPoolRunning) return;
  isPoolRunning = true;
  console.log(' Background Worker Pool started polling queues...');

  poolInterval = setInterval(processWorkerCycle, 1500);
}

/**
 * Stop worker loop
 */
export function stopWorkerPool() {
  if (poolInterval) clearInterval(poolInterval);
  isPoolRunning = false;
  console.log(' Background Worker Pool stopped');
}

/**
 * Main polling cycle for workers
 */
async function processWorkerCycle() {
  if (!isPoolRunning) return;

  // Fetch active worker nodes from DB
  const workers = db.prepare(`SELECT * FROM workers WHERE status != 'OFFLINE' AND status != 'PAUSED'`).all();

  for (const worker of workers) {
    if (worker.status === 'BUSY') continue; // Worker is currently executing a task
    if (!worker.assigned_queue_id) continue;

    // Attempt to dequeue next available task
    const message = dequeueMessage(worker.assigned_queue_id, worker.id);

    if (message) {
      // Execute task asynchronously
      runWorkerTask(worker, message);
    }
  }
}

/**
 * Simulate background task processing
 */
async function runWorkerTask(worker, message) {
  try {
    // 1. Mark worker as BUSY
    db.prepare(`UPDATE workers SET status = 'BUSY', last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?`).run(worker.id);
    broadcast({ type: 'WORKER_STATE_CHANGED', data: { workerId: worker.id, status: 'BUSY' } });

    // 2. Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, processingDelayMs));

    // 3. Determine success vs failure based on payload or simulated failure rate
    let payload = {};
    try { payload = JSON.parse(message.payload_json); } catch (e) {}

    const forceFail = payload.forceFail === true || payload.status === 'PAYMENT_DECLINED';
    const randomFail = Math.random() < simulatedFailureRate;

    if (forceFail || randomFail) {
      const errorReason = forceFail ? 'Explicit Payload Error: PAYMENT_DECLINED' : 'Simulated Worker Exception (Timeout / System Error)';
      
      // NACK Message
      nackMessage(message.id, worker.id, errorReason);

      // Update worker stats
      db.prepare(`UPDATE workers SET status = 'IDLE', failed_count = failed_count + 1, last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?`).run(worker.id);
    } else {
      // ACK Message
      ackMessage(message.id, worker.id);

      // Update worker stats
      db.prepare(`UPDATE workers SET status = 'IDLE', processed_count = processed_count + 1, last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?`).run(worker.id);
    }

    broadcast({ type: 'WORKER_STATE_CHANGED', data: { workerId: worker.id, status: 'IDLE' } });
  } catch (err) {
    console.error(` Error in worker [${worker.id}]:`, err);
    db.prepare(`UPDATE workers SET status = 'IDLE' WHERE id = ?`).run(worker.id);
  }
}

/**
 * Control Settings
 */
export function getWorkerPoolConfig() {
  return {
    isPoolRunning,
    simulatedFailureRate,
    processingDelayMs
  };
}

export function updateWorkerPoolConfig({ failureRate, delayMs, running }) {
  if (typeof failureRate === 'number') simulatedFailureRate = Math.max(0, Math.min(1, failureRate));
  if (typeof delayMs === 'number') processingDelayMs = Math.max(100, delayMs);
  if (typeof running === 'boolean') {
    if (running) startWorkerPool();
    else stopWorkerPool();
  }

  logSystemEvent('WORKER', 'INFO', `Updated worker configuration: FailureRate=${(simulatedFailureRate * 100).toFixed(0)}%, Delay=${processingDelayMs}ms, Active=${isPoolRunning}`);
  return getWorkerPoolConfig();
}

/**
 * Add a new virtual worker node
 */
export function addWorkerNode(name, queueId) {
  const id = 'worker-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  db.prepare(`
    INSERT INTO workers (id, name, assigned_queue_id, status, processed_count, failed_count)
    VALUES (?, ?, ?, 'IDLE', 0, 0)
  `).run(id, name, queueId);

  logSystemEvent('WORKER', 'SUCCESS', `Provisioned new Worker node [${name}] assigned to queue [${queueId}]`, { id });
  broadcast({ type: 'WORKER_ADDED', data: { id, name, queueId } });
  return { id, name, queueId };
}

/**
 * Remove or toggle worker node
 */
export function toggleWorkerNodeStatus(workerId, status) {
  db.prepare(`UPDATE workers SET status = ? WHERE id = ?`).run(status, workerId);
  broadcast({ type: 'WORKER_STATE_CHANGED', data: { workerId, status } });
}
