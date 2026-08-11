# 📚 DISTRIBUTED TASK PROCESSING PLATFORM - COMPREHENSIVE DOCUMENTATION MANUAL
***Mini AWS EventBridge + SQS Queue System + Distributed Worker Pool + Real-Time Telemetry Dashboard***

---

## 📌 Executive Summary

The **Distributed Task Processing Platform** is a full-stack, event-driven task processing system engineered to replicate the core components of enterprise cloud event streaming platforms such as **AWS EventBridge** and **Amazon Simple Queue Service (SQS)**.

The project demonstrates key distributed systems principles:
- **Asynchronous Ingestion**: Ingesting high-throughput events without blocking client requests.
- **Pattern-Based Filtering**: Evaluation of event payloads against key-value rules.
- **Atomic Concurrency & Lock Management**: Safe, multi-worker task dequeuing using database-level transaction locks.
- **Fault Tolerance & Resiliency**: Exponential backoff retry loops, visibility timeout release, and Dead-Letter Queue (DLQ) offloading.
- **Manual Operations & Re-driving**: Operator tools to inspect failed payloads, debug root causes, and re-drive tasks into processing pipelines.
- **Real-Time Telemetry**: Instant state updates pushed to the UI via WebSockets.

---

## 🏗️ System Architecture & Execution Lifecycle

```
==================================================================================================
                                    SYSTEM PIPELINE ARCHITECTURE
==================================================================================================

 [ Event Producer ] ---> ( Publish JSON Event )
        |
        v
 [ EventBridge Bus ] ---> ( Matches active rules: Source, Detail-Type, Pattern JSON )
        |
        +-----------------------------------------------+
        |                                               |
  (Rule Matched)                                 (No Rule Matched)
        |                                               |
        v                                               v
 [ Target SQS Queue ]                            [ Event Logged as UNMATCHED ]
 (Status: PENDING)
        |
        v
 [ Worker Polling Engine ] ---> ( Atomic SQLite Transaction Lock: Sets status to PROCESSING )
        |
        +-----------------------------------------------+
        |                                               |
 (Task Succeeded)                                (Task Failed)
        |                                               |
        v                                               v
 [ Mark COMPLETED (ACK) ]                   [ Increment Retry Count ]
                                                        |
                                        +---------------+---------------+
                                        |                               |
                           (Retry Count < Max)                 (Retry Count >= Max)
                                        |                               |
                                        v                               v
                          [ Re-queue PENDING with ]           [ Move to Dead Letter Queue ]
                          [ Exponential Backoff   ]           [ (DLQ) - Status UNRESOLVED ]
                                                                        |
                                                                        v
                                                               [ Manual Re-drive Action ]
                                                               [ -> Back to Queue PENDING ]
==================================================================================================
```

---

## 🖥️ Screen-by-Screen Deep Functionality Manual

The platform user interface provides **6 comprehensive control screens**. Below is the deep explanation of each screen, its capabilities, and step-by-step instructions on how to use it.

---

### Screen 1: 📊 Pipeline Visualizer Tab
**Component File**: [PipelineVisualizer.jsx](file:///c:/Users/lenovo/Documents/Distributed_Task_Processing_Platform/Distributed-Task-Processing-Platform/client/src/components/PipelineVisualizer.jsx)

#### Purpose & Capabilities:
The **Pipeline Visualizer** acts as the central command center and live telemetry overview. It provides high-level architecture stats, active queue depths, live worker node status, quick trigger buttons, and a live streaming WebSocket execution audit log terminal.

#### Screen Components:
1. **Quick Action Simulator Bar**:
   - **`New Order ($149.99)`**: Emits an `ecommerce.order -> OrderCreated` event. Matches the default order processing rule and routes to `order-processing-queue`.
   - **`User Signup`**: Emits a `user.auth -> UserRegistered` event. Routes to `user-notifications-queue`.
   - **`Payment Failure (Force DLQ)`**: Emits a `payment.gateway -> PaymentFailed` event with `forceFail: true`. Forces worker errors to demonstrate retry backoff and DLQ offloading.
   - **`Refresh Metrics`**: Reloads pipeline stats manually.
2. **Architecture Node Cards**:
   - **Producers**: Total count of ingested events.
   - **Rules Router**: Count of active routing rules in the system.
   - **Queue System**: Total count of pending tasks across all queues.
   - **Worker Pool**: Number of provisioned worker nodes.
   - **Dead Letter Queue**: Count of unresolved failed items awaiting operator review.
3. **Queue Depth Breakdown**: Live summary of each queue showing `Pending`, `Processing`, and `Completed` metrics alongside queue visibility timeouts and max retry settings.
4. **Worker Activity Monitor**: Displays active workers (`🟢 IDLE` or `⚡ BUSY`) with total succeeded (`✅`) and failed (`❌`) execution counters.
5. **Real-Time Audit Terminal**: Live streaming terminal displaying color-coded WebSocket telemetry logs (`[EVENTBRIDGE]`, `[QUEUE]`, `[WORKER]`, `[DLQ]`).

#### How to Use (Step-by-Step):
1. Click **Pipeline Visualizer** in the top navigation header.
2. Click **New Order ($149.99)** to fire a test order event.
3. Watch the **Producers** count increase, the **Queue System** pending metric update, and the worker node toggle to `⚡ BUSY`.
4. Observe the **Audit Terminal** at the bottom as logs stream in real-time.

---

### Screen 2: ⚡ Event Publisher & Burst Simulator Tab
**Component File**: [EventPublisher.jsx](file:///c:/Users/lenovo/Documents/Distributed_Task_Processing_Platform/Distributed-Task-Processing-Platform/client/src/components/EventPublisher.jsx)

#### Purpose & Capabilities:
The **Event Publisher** is an event ingestion console that allows you to publish custom JSON payloads to any event bus or generate high-throughput traffic bursts.

#### Screen Components:
1. **Preset Selectors**: One-click quick-loaders for common event structures (Order Created, User Signup, Payment Failed).
2. **Event Bus Dropdown**: Select target EventBridge bus (defaults to `default-event-bus`).
3. **Event Source Input**: Target domain identifier (e.g. `ecommerce.order`, `inventory.stock`).
4. **Detail-Type Input**: Event action identifier (e.g. `OrderCreated`, `StockUpdated`).
5. **Event Detail Payload JSON**: Interactive text area for editing raw JSON event payloads.
6. **Publish Event Button**: Submits the single event to the backend.
7. **Fire 15x Burst Traffic Button**: Automatically publishes 15 synthetic events spaced 200ms apart to simulate heavy production traffic.
8. **Ingestion & Routing Result Inspector**: Right-hand panel displaying the assigned `Event ID`, count of matched rules, routing status (`ROUTED` or `UNMATCHED`), and exact target queues.

#### How to Use (Step-by-Step):
1. Select the **Event Publisher** tab.
2. Click one of the preset buttons (e.g., **📦 Order Created**) or customize the JSON payload.
3. Click **Publish Event**.
4. Check the right-hand panel to confirm which rules matched and which queue received the message.
5. Click **Fire 15x Burst Traffic** to simulate high traffic load.

---

### Screen 3: 🔀 Event Rules Engine Manager Tab
**Component File**: [RuleManager.jsx](file:///c:/Users/lenovo/Documents/Distributed_Task_Processing_Platform/Distributed-Task-Processing-Platform/client/src/components/RuleManager.jsx)

#### Purpose & Capabilities:
The **Rule Manager** gives full control over EventBridge pattern-matching routing rules. Rules evaluate incoming event properties (`source`, `detail_type`, and JSON body patterns) and route matched events to designated SQS queues.

#### Screen Components:
1. **Rules Grid**: Displays all existing rules with their name, description, active status, source pattern, detail-type pattern, target queue name, and JSON pattern filter.
2. **Status Toggle Button**: Enables (`CheckCircle2`) or disables (`XCircle`) a rule without deleting it.
3. **Delete Rule Button**: Permanently removes a routing rule.
4. **Create New Rule Button**: Opens a creation modal.
5. **Create Rule Modal**:
   - **Rule Name** & **Description**.
   - **Event Source** (e.g. `ecommerce.order`).
   - **Detail-Type** (e.g. `OrderCreated`).
   - **Target SQS Queue** dropdown.
   - **Pattern Filter JSON**: A JSON object specifying key-value conditions required for matching (e.g. `{"status":"CONFIRMED"}`).

#### How to Use (Step-by-Step):
1. Select **Event Rules** from the header.
2. Click **Create New Rule**.
3. Fill in the rule details (e.g., Name: `High Value Order Router`, Event Source: `ecommerce.order`, Detail-Type: `OrderCreated`, Pattern Filter: `{"amount": 149.99}`).
4. Select the target queue and click **Create Rule**.
5. Test your new rule by publishing a matching event in the **Event Publisher** tab!

---

### Screen 4: 💾 SQS & Dead Letter Queue (DLQ) Inspector Tab
**Component File**: [QueueInspector.jsx](file:///c:/Users/lenovo/Documents/Distributed_Task_Processing_Platform/Distributed-Task-Processing-Platform/client/src/components/QueueInspector.jsx)

#### Purpose & Capabilities:
The **Queue Inspector** provides complete visibility into queue contents, message lifecycle states (`PENDING`, `PROCESSING`, `COMPLETED`, `DLQ`), retry histories, exception tracebacks, and Dead-Letter Queue (DLQ) manual re-driving.

#### Screen Components:
1. **Sub-Tab Switcher**:
   - **SQS Target Queues**: View normal message queues.
   - **Dead Letter Queue (DLQ)**: View unrecoverable failed messages.
2. **Queue Selector Sidebar** (Target Queues View): Displays all queues with pending and completed counts.
3. **Queue Messages View**:
   - Message ID, status badge, retry count, payload JSON, and error details.
4. **DLQ Inspector & Re-drive Panel** (DLQ View):
   - Displays failed messages that exceeded maximum retry attempts.
   - Shows original queue name, failure reason, and attempt count.
   - **Re-drive to Queue Button**: Re-enqueues the failed message back into its original processing queue as a clean `PENDING` task.

#### How to Use (Step-by-Step):
1. Click **SQS & DLQ** in the top navigation bar.
2. Select any queue on the left sidebar to inspect pending or completed messages.
3. Switch to the **Dead Letter Queue** tab.
4. Locate any failed items, read the **Fail Reason**, and click **Re-drive to Queue** to re-process the item.

---

### Screen 5: ⚙️ Worker Pool & Simulation Controls Tab
**Component File**: [WorkerControl.jsx](file:///c:/Users/lenovo/Documents/Distributed_Task_Processing_Platform/Distributed-Task-Processing-Platform/client/src/components/WorkerControl.jsx)

#### Purpose & Capabilities:
The **Worker Control** screen allows operators to scale worker capacity dynamically, control global engine execution, and inject artificial failures or latency to stress-test system resiliency.

#### Screen Components:
1. **Background Processing Loop Toggle**: Pause or resume worker polling globally across the application.
2. **Artificial Failure Injection Rate Slider (0% - 100%)**: Artificially causes worker executions to fail. Used for verifying automatic exponential backoff retry timing and DLQ routing.
3. **Simulated Execution Latency Slider (100ms - 4000ms)**: Adjusts how long worker tasks take to process.
4. **Provision & Scale Worker Pool Form**: Create new worker nodes assigned to specific queues.
5. **Worker Nodes Control List**: Displays worker status (`IDLE`, `BUSY`, `PAUSED`) and provides individual Pause/Resume controls.

#### How to Use (Step-by-Step):
1. Select **Workers Pool** from the header.
2. Drag the **Artificial Failure Injection Rate** slider to **50%**.
3. Go to **Event Publisher** and publish a few events.
4. Return to **Workers Pool** or **Pipeline Visualizer** to see workers failing, retrying, and offloading tasks to the DLQ.
5. Provision a new worker node by entering a name (e.g. `Order-Worker-Beta`), selecting a queue, and clicking **Add Node**.

---

### Screen 6: 🗄️ SQL Reference & Catalog Viewer Tab
**Component File**: [SqlViewer.jsx](file:///c:/Users/lenovo/Documents/Distributed_Task_Processing_Platform/Distributed-Task-Processing-Platform/client/src/components/SqlViewer.jsx)

#### Purpose & Capabilities:
The **SQL Reference** tab presents the complete database schema (`database.sql`), performance indexes, seed data, and explicit CRUD query catalog used throughout the backend engine.

#### Screen Components:
1. **Raw SQL View Code Block**: Formatted presentation of `database.sql`.
2. **Copy SQL File Button**: Copies the complete database script directly to the clipboard.

#### How to Use (Step-by-Step):
1. Click **SQL Reference** in the top navigation bar.
2. Review table DDL schemas, indexes, and backend SQL queries.
3. Click **Copy SQL File** if you wish to inspect or run queries in an external database management tool.

---

## 🛠️ Backend API Endpoints Reference

### Overview & Telemetry
- `GET /api/overview` - Fetch high-level statistics and queue summaries.
- `GET /api/logs?limit=50` - Fetch execution audit logs.

### EventBus & Events
- `GET /api/buses` - List event buses.
- `GET /api/events?limit=50` - Fetch ingested events.
- `POST /api/events/publish` - Publish an event to EventBridge.

### Event Rules Engine
- `GET /api/rules` - Fetch routing rules.
- `POST /api/rules` - Create a new routing rule.
- `PUT /api/rules/:id/toggle` - Enable or disable a rule.
- `DELETE /api/rules/:id` - Delete a rule.

### Queue & DLQ Management
- `GET /api/queues` - List queues and message counters.
- `POST /api/queues` - Create a new queue.
- `GET /api/queues/:queueId/messages` - Fetch messages inside a queue.
- `GET /api/dlq` - List Dead Letter Queue records.
- `POST /api/dlq/redrive/:dlqId` - Re-drive a DLQ message back to its queue.

### Worker Pool Management
- `GET /api/workers` - List worker nodes and simulation config.
- `POST /api/workers` - Provision a new worker node.
- `PUT /api/workers/:workerId/status` - Pause or activate a worker.
- `POST /api/workers/config` - Update failure rate and latency simulation settings.

---

## 💻 Tech Stack & Dependencies

- **Backend**: Node.js (v18+ / v24), Express, `better-sqlite3` (with `node:sqlite` fallback), `ws` (WebSockets), `dotenv`, `cors`.
- **Database**: SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and Foreign Key enforcement.
- **Frontend**: React 18, Vite, Lucide React Icons, Vanilla CSS Design System with Glassmorphism and dark mode aesthetics.

---
*Distributed Task Processing Platform Manual - 2026*
