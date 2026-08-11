-- ============================================================================
-- DISTRIBUTED TASK PROCESSING PLATFORM (MINI AWS EVENTBRIDGE + QUEUE SYSTEM)
-- Complete Database Schema DDL, Indexes, Seed Data, and CRUD Query Catalog
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DATABASE SCHEMA (DDL)
-- ----------------------------------------------------------------------------

-- Enable foreign key support in SQLite
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- Table: event_buses
-- Purpose: Manages EventBridge Event Buses (e.g. default, ecommerce-bus, system-bus)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_buses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- Table: event_rules
-- Purpose: Defines routing rules for matching events based on Source, Detail-Type, and Pattern
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_rules (
    id TEXT PRIMARY KEY,
    bus_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    event_source TEXT NOT NULL,       -- e.g. "ecommerce.order", "user.auth", "payment.gateway"
    detail_type TEXT NOT NULL,        -- e.g. "OrderCreated", "UserRegistered", "PaymentFailed"
    pattern_json TEXT DEFAULT '{}',   -- JSON string pattern for matching detail object
    target_queue_id TEXT NOT NULL,    -- Destination queue ID
    is_active INTEGER DEFAULT 1,      -- 1 = Active, 0 = Disabled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES event_buses(id) ON DELETE CASCADE,
    FOREIGN KEY (target_queue_id) REFERENCES queues(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Table: events
-- Purpose: Ingested events published to the EventBridge bus
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    bus_id TEXT NOT NULL,
    source TEXT NOT NULL,
    detail_type TEXT NOT NULL,
    detail_json TEXT NOT NULL,        -- JSON payload
    matched_rules_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PROCESSED',   -- 'INGESTED', 'ROUTED', 'PROCESSED', 'FAILED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES event_buses(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Table: queues
-- Purpose: Named SQS-style Message Queues with retry & DLQ configurations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    max_retries INTEGER DEFAULT 3,
    visibility_timeout_sec INTEGER DEFAULT 30,
    concurrency_limit INTEGER DEFAULT 5,
    is_dlq INTEGER DEFAULT 0,         -- 1 if queue itself is a Dead-Letter Queue
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- Table: queue_messages
-- Purpose: Individual tasks/messages residing in queues waiting to be processed by workers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queue_messages (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    event_id TEXT,
    payload_json TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',    -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DLQ'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    visible_after DATETIME DEFAULT CURRENT_TIMESTAMP,
    locked_by_worker TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- Table: dead_letter_queue
-- Purpose: Stores failed tasks that exceeded maximum retries for inspection and manual re-drive
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id TEXT PRIMARY KEY,
    original_message_id TEXT NOT NULL,
    original_queue_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    fail_reason TEXT,
    retry_attempts INTEGER DEFAULT 0,
    moved_to_dlq_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'UNRESOLVED', -- 'UNRESOLVED', 'REDRIVEN', 'DISCARDED'
    FOREIGN KEY (original_queue_id) REFERENCES queues(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Table: workers
-- Purpose: Virtual worker nodes processing tasks from queues
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    assigned_queue_id TEXT,
    status TEXT DEFAULT 'IDLE',       -- 'IDLE', 'BUSY', 'OFFLINE', 'PAUSED'
    processed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_queue_id) REFERENCES queues(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- Table: execution_logs
-- Purpose: System-wide execution & audit log for monitoring real-time flow
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS execution_logs (
    id TEXT PRIMARY KEY,
    component TEXT NOT NULL,          -- 'EVENTBRIDGE', 'QUEUE', 'WORKER', 'DLQ'
    log_level TEXT DEFAULT 'INFO',    -- 'INFO', 'WARN', 'ERROR', 'SUCCESS'
    message TEXT NOT NULL,
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ----------------------------------------------------------------------------
-- 2. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_events_bus_source ON events(bus_id, source, detail_type);
CREATE INDEX IF NOT EXISTS idx_event_rules_source ON event_rules(event_source, detail_type, is_active);
CREATE INDEX IF NOT EXISTS idx_queue_messages_fetch ON queue_messages(queue_id, status, visible_after);
CREATE INDEX IF NOT EXISTS idx_queue_messages_status ON queue_messages(status);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON dead_letter_queue(status);
CREATE INDEX IF NOT EXISTS idx_logs_component ON execution_logs(component, log_level);


-- ----------------------------------------------------------------------------
-- 3. SEED INITIAL DATA
-- ----------------------------------------------------------------------------

-- Default Event Bus
INSERT OR IGNORE INTO event_buses (id, name, description) VALUES
('bus-default', 'default-event-bus', 'Main application event router bus');

-- Default Queues
INSERT OR IGNORE INTO queues (id, name, description, max_retries, visibility_timeout_sec, concurrency_limit, is_dlq) VALUES
('queue-order-processing', 'order-processing-queue', 'Handles order fulfillment & inventory deduction', 3, 10, 3, 0),
('queue-user-notifications', 'user-notifications-queue', 'Dispatches welcome emails & SMS alerts', 2, 5, 2, 0),
('queue-payment-settlements', 'payment-settlement-queue', 'Processes background transaction settlements', 4, 15, 2, 0),
('queue-dead-letter', 'global-dead-letter-queue', 'Catches unrecoverable failed queue tasks', 0, 0, 0, 1);

-- Default Event Rules
INSERT OR IGNORE INTO event_rules (id, bus_id, name, description, event_source, detail_type, pattern_json, target_queue_id, is_active) VALUES
('rule-order-created', 'bus-default', 'Order Placement Router', 'Routes new orders to order processing queue', 'ecommerce.order', 'OrderCreated', '{"status":"CONFIRMED"}', 'queue-order-processing', 1),
('rule-user-signup', 'bus-default', 'User Registration Router', 'Routes user signups to notifications queue', 'user.auth', 'UserRegistered', '{}', 'queue-user-notifications', 1),
('rule-payment-failed', 'bus-default', 'Payment Failure Alert Router', 'Routes failed payments to settlements & alerts', 'payment.gateway', 'PaymentFailed', '{}', 'queue-payment-settlements', 1);

-- Initial Worker Nodes
INSERT OR IGNORE INTO workers (id, name, assigned_queue_id, status, processed_count, failed_count) VALUES
('worker-1', 'Order-Worker-Alpha', 'queue-order-processing', 'IDLE', 0, 0),
('worker-2', 'Notify-Worker-Beta', 'queue-user-notifications', 'IDLE', 0, 0),
('worker-3', 'Payment-Worker-Gamma', 'queue-payment-settlements', 'IDLE', 0, 0);


-- ============================================================================
-- 4. COMPLETE CATALOG OF CRUD & SYSTEM QUERY QUERIES USED BY APPLICATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A: EVENT BUS & EVENTS CRUD QUERIES
-- ----------------------------------------------------------------------------

-- [CREATE] Publish new ingested event to EventBridge Bus
-- INSERT INTO events (id, bus_id, source, detail_type, detail_json, matched_rules_count, status)
-- VALUES (?, ?, ?, ?, ?, ?, ?);

-- [READ] Get recent events with pagination and filtering
-- SELECT e.*, b.name as bus_name 
-- FROM events e 
-- JOIN event_buses b ON e.bus_id = b.id 
-- ORDER BY e.created_at DESC LIMIT ? OFFSET ?;

-- [READ] Get event details by ID with matched execution logs
-- SELECT * FROM events WHERE id = ?;

-- [UPDATE] Update matched rule count and status on event
-- UPDATE events SET matched_rules_count = ?, status = ? WHERE id = ?;

-- [DELETE] Purge old events older than X days
-- DELETE FROM events WHERE created_at < datetime('now', '-7 days');

-- ----------------------------------------------------------------------------
-- SECTION B: EVENT RULES ENGINE CRUD QUERIES
-- ----------------------------------------------------------------------------

-- [CREATE] Create new EventBridge Rule
-- INSERT INTO event_rules (id, bus_id, name, description, event_source, detail_type, pattern_json, target_queue_id, is_active)
-- VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- [READ] Find matching active rules for an incoming event
-- SELECT r.*, q.name as queue_name 
-- FROM event_rules r
-- JOIN queues q ON r.target_queue_id = q.id
-- WHERE r.bus_id = ? 
--   AND r.event_source = ? 
--   AND r.detail_type = ? 
--   AND r.is_active = 1;

-- [READ] List all rules with queue details
-- SELECT r.*, b.name as bus_name, q.name as target_queue_name 
-- FROM event_rules r
-- JOIN event_buses b ON r.bus_id = b.id
-- JOIN queues q ON r.target_queue_id = q.id
-- ORDER BY r.created_at DESC;

-- [UPDATE] Update Rule pattern or toggle active status
-- UPDATE event_rules 
-- SET name = ?, description = ?, event_source = ?, detail_type = ?, pattern_json = ?, target_queue_id = ?, is_active = ?
-- WHERE id = ?;

-- [DELETE] Delete a rule
-- DELETE FROM event_rules WHERE id = ?;

-- ----------------------------------------------------------------------------
-- SECTION C: QUEUE SYSTEM & MESSAGE MANAGEMENT CRUD QUERIES
-- ----------------------------------------------------------------------------

-- [CREATE] Create new queue
-- INSERT INTO queues (id, name, description, max_retries, visibility_timeout_sec, concurrency_limit, is_dlq)
-- VALUES (?, ?, ?, ?, ?, ?, ?);

-- [READ] Fetch all queues with message metrics count
-- SELECT q.*, 
--   SUM(CASE WHEN m.status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
--   SUM(CASE WHEN m.status = 'PROCESSING' THEN 1 ELSE 0 END) as processing_count,
--   SUM(CASE WHEN m.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
--   SUM(CASE WHEN m.status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
-- FROM queues q
-- LEFT JOIN queue_messages m ON q.id = m.queue_id
-- GROUP BY q.id;

-- [CREATE] Enqueue a message to target queue
-- INSERT INTO queue_messages (id, queue_id, event_id, payload_json, status, retry_count, visible_after)
-- VALUES (?, ?, ?, ?, 'PENDING', 0, CURRENT_TIMESTAMP);

-- [UPDATE] Atomic Dequeue & Lock message for worker execution (SQS ReceiveMessage logic)
-- UPDATE queue_messages 
-- SET status = 'PROCESSING',
--     locked_by_worker = ?,
--     visible_after = datetime('now', '+' || ? || ' seconds'),
--     updated_at = CURRENT_TIMESTAMP
-- WHERE id = (
--     SELECT id FROM queue_messages 
--     WHERE queue_id = ? 
--       AND status = 'PENDING' 
--       AND visible_after <= CURRENT_TIMESTAMP 
--     ORDER BY created_at ASC 
--     LIMIT 1
-- );

-- [UPDATE] Complete Message (ACK / Delete from queue processing)
-- UPDATE queue_messages 
-- SET status = 'COMPLETED', locked_by_worker = NULL, updated_at = CURRENT_TIMESTAMP 
-- WHERE id = ?;

-- [UPDATE] Fail Message & Increment Retry Count (NACK / Visibility timeout release)
-- UPDATE queue_messages 
-- SET status = 'PENDING', 
--     retry_count = retry_count + 1, 
--     error_message = ?, 
--     locked_by_worker = NULL, 
--     visible_after = datetime('now', '+' || ? || ' seconds'),
--     updated_at = CURRENT_TIMESTAMP 
-- WHERE id = ?;

-- [DELETE/MOVE] Move to Dead Letter Queue (DLQ) after exceeding max retries
-- UPDATE queue_messages SET status = 'DLQ', error_message = ? WHERE id = ?;
-- INSERT INTO dead_letter_queue (id, original_message_id, original_queue_id, payload_json, fail_reason, retry_attempts)
-- VALUES (?, ?, ?, ?, ?, ?);

-- ----------------------------------------------------------------------------
-- SECTION D: DEAD LETTER QUEUE (DLQ) & RE-DRIVE QUERIES
-- ----------------------------------------------------------------------------

-- [READ] List all unhandled messages in Dead Letter Queue
-- SELECT d.*, q.name as original_queue_name
-- FROM dead_letter_queue d
-- JOIN queues q ON d.original_queue_id = q.id
-- WHERE d.status = 'UNRESOLVED'
-- ORDER BY d.moved_to_dlq_at DESC;

-- [UPDATE] Re-drive DLQ message back into primary processing queue
-- UPDATE dead_letter_queue SET status = 'REDRIVEN' WHERE id = ?;
-- INSERT INTO queue_messages (id, queue_id, payload_json, status, retry_count, visible_after)
-- VALUES (?, ?, ?, 'PENDING', 0, CURRENT_TIMESTAMP);

-- ----------------------------------------------------------------------------
-- SECTION E: WORKER POOL MANAGEMENT QUERIES
-- ----------------------------------------------------------------------------

-- [READ] Fetch active workers and stats
-- SELECT w.*, q.name as queue_name 
-- FROM workers w 
-- LEFT JOIN queues q ON w.assigned_queue_id = q.id;

-- [UPDATE] Worker heartbeat & metrics update
-- UPDATE workers 
-- SET status = ?, processed_count = processed_count + ?, failed_count = failed_count + ?, last_heartbeat = CURRENT_TIMESTAMP 
-- WHERE id = ?;

-- [CREATE] Add worker node
-- INSERT INTO workers (id, name, assigned_queue_id, status) VALUES (?, ?, ?, 'IDLE');

-- ----------------------------------------------------------------------------
-- SECTION F: EXECUTION LOGS & TELEMETRY QUERIES
-- ----------------------------------------------------------------------------

-- [CREATE] Insert system execution log
-- INSERT INTO execution_logs (id, component, log_level, message, metadata_json)
-- VALUES (?, ?, ?, ?, ?);

-- [READ] Fetch latest system telemetry logs
-- SELECT * FROM execution_logs ORDER BY created_at DESC LIMIT 100;
