import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { publishEvent } from '../eventBridge.js';
import { getQueuesOverview, redriveDLQMessage } from '../queueManager.js';
import { addWorkerNode, toggleWorkerNodeStatus, getWorkerPoolConfig, updateWorkerPoolConfig } from '../workerPool.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlFilePath = path.join(__dirname, '..', '..', '..', 'database.sql');

// ----------------------------------------------------------------------------
// 1. OVERVIEW & METRICS API
// ----------------------------------------------------------------------------
router.get('/overview', (req, res) => {
  try {
    const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
    const totalRules = db.prepare('SELECT COUNT(*) as count FROM event_rules WHERE is_active = 1').get().count;
    const queues = getQueuesOverview();
    const activeWorkers = db.prepare("SELECT COUNT(*) as count FROM workers WHERE status != 'OFFLINE'").get().count;
    const dlqUnresolvedCount = db.prepare("SELECT COUNT(*) as count FROM dead_letter_queue WHERE status = 'UNRESOLVED'").get().count;

    const totalPendingMessages = queues.reduce((sum, q) => sum + (q.pending_count || 0), 0);
    const totalProcessingMessages = queues.reduce((sum, q) => sum + (q.processing_count || 0), 0);
    const totalCompletedMessages = queues.reduce((sum, q) => sum + (q.completed_count || 0), 0);

    res.json({
      success: true,
      stats: {
        totalEvents,
        totalRules,
        activeWorkers,
        dlqUnresolvedCount,
        totalPendingMessages,
        totalProcessingMessages,
        totalCompletedMessages
      },
      queues
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 2. EVENTBUS & EVENTS API
// ----------------------------------------------------------------------------
router.get('/buses', (req, res) => {
  const buses = db.prepare('SELECT * FROM event_buses ORDER BY name ASC').all();
  res.json({ success: true, buses });
});

router.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit || '50');
  const events = db.prepare(`
    SELECT e.*, b.name as bus_name 
    FROM events e 
    JOIN event_buses b ON e.bus_id = b.id 
    ORDER BY e.created_at DESC 
    LIMIT ?
  `).all(limit);
  res.json({ success: true, events });
});

router.post('/events/publish', (req, res) => {
  try {
    const { bus_id, source, detail_type, detail } = req.body;
    if (!source || !detail_type) {
      return res.status(400).json({ success: false, error: 'Source and detail_type are required' });
    }

    const result = publishEvent({ bus_id, source, detail_type, detail });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 3. EVENT RULES ENGINE API
// ----------------------------------------------------------------------------
router.get('/rules', (req, res) => {
  const rules = db.prepare(`
    SELECT r.*, b.name as bus_name, q.name as target_queue_name 
    FROM event_rules r
    JOIN event_buses b ON r.bus_id = b.id
    JOIN queues q ON r.target_queue_id = q.id
    ORDER BY r.created_at DESC
  `).all();
  res.json({ success: true, rules });
});

router.post('/rules', (req, res) => {
  try {
    const { bus_id = 'bus-default', name, description, event_source, detail_type, pattern_json, target_queue_id } = req.body;
    if (!name || !event_source || !detail_type || !target_queue_id) {
      return res.status(400).json({ success: false, error: 'Missing required rule parameters' });
    }

    const id = 'rule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    db.prepare(`
      INSERT INTO event_rules (id, bus_id, name, description, event_source, detail_type, pattern_json, target_queue_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, bus_id, name, description || '', event_source, detail_type, pattern_json || '{}', target_queue_id);

    res.json({ success: true, ruleId: id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/rules/:id/toggle', (req, res) => {
  try {
    const { is_active } = req.body;
    db.prepare('UPDATE event_rules SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/rules/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM event_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 4. QUEUE SYSTEM & MESSAGES API
// ----------------------------------------------------------------------------
router.get('/queues', (req, res) => {
  const queues = getQueuesOverview();
  res.json({ success: true, queues });
});

router.post('/queues', (req, res) => {
  try {
    const { name, description, max_retries = 3, visibility_timeout_sec = 10, concurrency_limit = 5, is_dlq = 0 } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Queue name required' });

    const id = 'queue-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    db.prepare(`
      INSERT INTO queues (id, name, description, max_retries, visibility_timeout_sec, concurrency_limit, is_dlq)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description || '', max_retries, visibility_timeout_sec, concurrency_limit, is_dlq ? 1 : 0);

    res.json({ success: true, queueId: id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/queues/:queueId/messages', (req, res) => {
  const limit = parseInt(req.query.limit || '100');
  const messages = db.prepare(`
    SELECT * FROM queue_messages 
    WHERE queue_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(req.params.queueId, limit);
  res.json({ success: true, messages });
});

// ----------------------------------------------------------------------------
// 5. DEAD LETTER QUEUE (DLQ) & RE-DRIVE API
// ----------------------------------------------------------------------------
router.get('/dlq', (req, res) => {
  const records = db.prepare(`
    SELECT d.*, q.name as original_queue_name
    FROM dead_letter_queue d
    JOIN queues q ON d.original_queue_id = q.id
    ORDER BY d.moved_to_dlq_at DESC
  `).all();
  res.json({ success: true, records });
});

router.post('/dlq/redrive/:dlqId', (req, res) => {
  try {
    const result = redriveDLQMessage(req.params.dlqId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 6. WORKERS POOL & CONFIG API
// ----------------------------------------------------------------------------
router.get('/workers', (req, res) => {
  const workers = db.prepare(`
    SELECT w.*, q.name as assigned_queue_name 
    FROM workers w 
    LEFT JOIN queues q ON w.assigned_queue_id = q.id
    ORDER BY w.created_at ASC
  `).all();
  const config = getWorkerPoolConfig();
  res.json({ success: true, workers, config });
});

router.post('/workers', (req, res) => {
  try {
    const { name, queueId } = req.body;
    if (!name || !queueId) return res.status(400).json({ success: false, error: 'Name and queueId required' });
    const worker = addWorkerNode(name, queueId);
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/workers/:workerId/status', (req, res) => {
  try {
    const { status } = req.body;
    toggleWorkerNodeStatus(req.params.workerId, status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/workers/config', (req, res) => {
  try {
    const newConfig = updateWorkerPoolConfig(req.body);
    res.json({ success: true, config: newConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 7. EXECUTION LOGS API
// ----------------------------------------------------------------------------
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit || '100');
  const logs = db.prepare(`
    SELECT * FROM execution_logs ORDER BY created_at DESC LIMIT ?
  `).all(limit);
  res.json({ success: true, logs });
});

// ----------------------------------------------------------------------------
// 8. RAW SQL FILE VIEWER API (Exposes database.sql to frontend)
// ----------------------------------------------------------------------------
router.get('/sql-file', (req, res) => {
  try {
    if (fs.existsSync(sqlFilePath)) {
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
      res.json({ success: true, sqlContent });
    } else {
      res.status(404).json({ success: false, error: 'database.sql file not found on server' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
