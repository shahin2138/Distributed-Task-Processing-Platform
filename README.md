# 🚀 Distributed Task Processing Platform
### *Mini AWS EventBridge + SQS Queue System + Distributed Worker Pool + Real-Time Telemetry Dashboard*

A enterprise-grade, event-driven distributed task processing platform built with **Node.js, Express, SQLite (WAL mode), WebSockets, and React (Vite)**. The platform mirrors the core architecture of **AWS EventBridge** and **Amazon SQS**, featuring pattern-based event routing, atomic queue message locking, automatic retry handling with backoff, Dead-Letter Queue (DLQ) offloading, manual message re-driving, dynamic worker scaling, artificial failure injection, and live WebSocket telemetry streaming.

---

## 📑 Table of Contents
1. [Architecture & System Flow](#-architecture--system-flow)
2. [Key Features & Capabilities](#-key-features--capabilities)
3. [Deep Screen-by-Screen Guide & Functionality](#-deep-screen-by-screen-guide--functionality)
   - [1. Pipeline Visualizer](#1-pipeline-visualizer)
   - [2. Event Publisher & Burst Simulator](#2-event-publisher--burst-simulator)
   - [3. Event Rules Engine Manager](#3-event-rules-engine-manager)
   - [4. SQS & Dead Letter Queue (DLQ) Inspector](#4-sqs--dead-letter-queue-dlq-inspector)
   - [5. Worker Pool & Simulation Controls](#5-worker-pool--simulation-controls)
   - [6. SQL Database Reference & Query Catalog](#6-sql-database-reference--query-catalog)
4. [Step-by-Step Usage Guide (End-to-End Walkthrough)](#-step-by-step-usage-guide-end-to-end-walkthrough)
5. [Database Schema & Data Model](#-database-schema--data-model)
6. [Getting Started & Local Setup](#-getting-started--local-setup)

---

## 🏗️ Architecture & System Flow

The system processes events asynchronously using a multi-stage pipeline:

```
+------------------+      Publish Event      +-------------------------+
|  Event Producer  | ----------------------> |  EventBridge Event Bus  |
|  (UI / REST API) |                         |      (event_buses)      |
+------------------+                         +-------------------------+
                                                          |
                                                          v
                                             +-------------------------+
                                             | Pattern Matching Engine |
                                             |      (event_rules)      |
                                             +-------------------------+
                                                          |
                                             Matches Source, Detail-Type & JSON Pattern
                                                          |
                                                          v
                                             +-------------------------+
                                             |    Target SQS Queues    |
                                             |    (queue_messages)     |
                                             +-------------------------+
                                                          |
                                       Atomic Lock & Dequeue (Visibility Timeout)
                                                          |
                                                          v
                                             +-------------------------+
                                             | Distributed Worker Pool |
                                             |        (workers)        |
                                             +-------------------------+
                                              /                       \
                                        SUCCESS                       FAILURE
                                         (ACK)                        (NACK)
                                          /                             \
                          +------------------+                +-------------------------+
                          | Task Completed   |                | Retry Count < Max       |
                          +------------------+                | -> Exponential Backoff  |
                                                              +-------------------------+
                                                                          |
                                                                Retry Count >= Max
                                                                          |
                                                                          v
                                                              +-------------------------+
                                                              | Dead Letter Queue (DLQ) |
                                                              |    Manual Re-drive      |
                                                              +-------------------------+
```

### How It Works Under the Hood:
1. **Event Ingestion**: Event producers send event payloads containing `source` (e.g. `ecommerce.order`), `detail_type` (e.g. `OrderCreated`), and a JSON `detail` payload to an Event Bus (`bus-default`).
2. **Rule Evaluation & Routing**: The EventBridge engine evaluates active routing rules. If the event's source, detail-type, and optional JSON pattern filter match, the system creates queue message records in target SQS queues with status `PENDING`.
3. **Atomic Message Locking**: Worker nodes poll their assigned queues. When picking up a task, an atomic SQL transaction updates the message status to `PROCESSING`, assigns `locked_by_worker`, and sets a `visible_after` timestamp according to the queue's visibility timeout (preventing duplicate processing by other workers).
4. **Task Execution & ACK/NACK**:
   - **Success (ACK)**: Worker updates message status to `COMPLETED` and releases the lock.
   - **Failure (NACK)**: If execution fails, the retry counter increments. If retries remain, the message visibility is delayed (exponential backoff).
5. **Dead-Letter Queue (DLQ)**: Once retries reach `max_retries`, the message transitions to `DLQ` status and creates a `dead_letter_queue` record for operator review.
6. **Manual Re-drive**: Operators can inspect DLQ failures, review fail reasons, and click **Re-drive** to re-inject the failed message back into its original processing queue.
7. **Real-Time Telemetry**: Every state change broadcasts over WebSockets to update the React dashboard instantly without requiring manual page reloads.

---

## ✨ Key Features & Capabilities

- **Pattern Matching Engine**: Supports key-value filtering and nested JSON object matching.
- **Atomic Dequeue Transaction**: Uses SQLite transactions (`BEGIN IMMEDIATE` / `COMMIT`) for concurrency-safe message locks.
- **Configurable Queues**: Customize `max_retries`, `visibility_timeout_sec`, and concurrency limits per queue.
- **Resilient Worker Loops**: Polling loops process tasks independently, with worker status tracking (`IDLE`, `BUSY`, `PAUSED`).
- **Failure Injection & Latency Simulation**: Interactively slide artificial failure rates (0% to 100%) and execution delays (100ms to 4000ms) to test queue resilience under stress.
- **Traffic Burst Generator**: Fire 15x high-throughput burst events with one click.
- **Full Database Schema Catalog**: Built-in SQL viewer tab exposing DDL and optimized query catalog.

---

## 🖥️ Deep Screen-by-Screen Guide & Functionality

The platform interface consists of **6 dedicated tabs**, accessible from the top navigation bar:

---

### 1. Pipeline Visualizer
The central operational dashboard displaying real-time system metrics, architecture stage cards, live worker states, queue depth breakdown, and an execution audit terminal.

#### 📊 Screen Elements & Components:
- **Simulate Live Event Trigger Bar (Top)**:
  - `New Order ($149.99)`: Publishes a sample `ecommerce.order -> OrderCreated` event.
  - `User Signup`: Publishes a sample `user.auth -> UserRegistered` event.
  - `Payment Failure (Force DLQ)`: Publishes a sample `payment.gateway -> PaymentFailed` event with `forceFail: true` to trigger automatic retry exhaustion and DLQ routing.
  - `Refresh Metrics`: Forces an immediate re-fetch of telemetry stats.
- **Pipeline Architecture Nodes (5 Stage Cards)**:
  - **Producers**: Total published events counter.
  - **EventBridge**: Count of active filter rules.
  - **Queue System**: Total count of pending messages across all queues.
  - **Worker Pool**: Count of active worker nodes.
  - **Dead Letter Queue**: Count of unresolved DLQ failures.
- **Queue Depth & Status Summary Table**: Shows every queue's name, `max_retries`, `visibility_timeout_sec`, and live badge counts for `Pending`, `Processing`, and `Done`.
- **Active Workers Activity Table**: Real-time worker status (`🟢 IDLE` or `⚡ BUSY`) with total successful (`✅`) and failed (`❌`) execution counts.
- **System Execution Audit Terminal**: Live streaming log terminal receiving WebSocket telemetry events (`[EVENTBRIDGE]`, `[QUEUE]`, `[WORKER]`, `[DLQ]`).

---

### 2. Event Publisher & Burst Simulator
The event ingestion playground for publishing custom events or generating traffic bursts.

#### 📊 Screen Elements & Components:
- **Preset Quick-Load Buttons**:
  - 📦 `Order Created`
  - 👤 `User Signup`
  - 💥 `Payment Failed`
- **Ingestion Form**:
  - **Event Bus**: Select target bus (e.g. `default-event-bus`).
  - **Event Source**: Enter domain source string (e.g. `ecommerce.order`).
  - **Detail Type**: Enter event action string (e.g. `OrderCreated`).
  - **Event Detail Payload (JSON)**: Editable JSON payload editor.
- **Action Buttons**:
  - `Publish Event`: Sends the custom event immediately.
  - `Fire 15x Burst Traffic`: Launches a burst sequence publishing 15 events spaced 200ms apart across different event types.
- **Ingested & Routing Result Inspector (Right Panel)**: Displays generated `eventId`, count of matched rules, final routing status (`ROUTED` or `UNMATCHED`), and exact target queues mapped by the matching rules.

---

### 3. Event Rules Engine Manager
The configuration panel for creating, toggling, and deleting EventBridge pattern routing rules.

#### 📊 Screen Elements & Components:
- **Rules Grid**: Displays cards for all configured rules with:
  - Rule Name & Description.
  - Active/Disabled toggle icon (`CheckCircle2` / `XCircle`).
  - Mapped Event Source, Detail-Type, and Destination Queue.
  - Pattern Filter JSON preview block.
  - `Delete Rule` button.
- **Create New Rule Modal**:
  - **Rule Name** & **Description** fields.
  - **Event Source** & **Detail-Type** matching targets.
  - **Target SQS Queue** dropdown selector.
  - **Pattern Filter JSON**: Accepts key-value filter requirements (e.g. `{"status":"CONFIRMED"}`).

---

### 4. SQS & Dead Letter Queue (DLQ) Inspector
A deep inspection tab for examining queue message states, payload details, error traces, and performing manual DLQ re-drives.

#### 📊 Screen Elements & Components:
- **Tab Switcher**:
  - **SQS Target Queues**: Shows active queues and message contents.
  - **Dead Letter Queue (DLQ)**: Shows unhandled failed messages.
- **SQS Target Queues View**:
  - Left sidebar queue list with pending/completed indicators.
  - Message details list showing `Message ID`, status badge (`PENDING`, `PROCESSING`, `COMPLETED`, `DLQ`), `Retry Count`, payload JSON, and exception stack trace.
- **Dead Letter Queue (DLQ) View**:
  - Lists all failed messages exceeding retry limits.
  - Displays original queue name, failure reason, and total attempt count.
  - **Re-drive to Queue** button: Atomically moves the item back into its original processing queue with clean retry stats.

---

### 5. Worker Pool & Simulation Controls
The worker orchestrator screen for dynamic scaling, artificial failure injection, and worker state control.

#### 📊 Screen Elements & Components:
- **Simulation & Failure Injection Controls**:
  - **Global Engine Toggle**: Pause or resume the entire background polling loop.
  - **Artificial Failure Injection Rate Slider (0% - 100%)**: Artificially injects failures into worker executions to verify backoff retry delays and DLQ routing.
  - **Simulated Processing Execution Latency Slider (100ms - 4000ms)**: Adjusts task execution duration.
- **Provision & Scale Worker Pool**:
  - **Add Worker Node Form**: Input worker name and assign it to any queue.
  - **Worker List**: Displays worker status, assigned queue, and pause/resume button per node.

---

### 6. SQL Database Reference & Query Catalog
A developer utility screen showing the underlying database architecture and query catalog.

#### 📊 Screen Elements & Components:
- Displays raw contents of [database.sql](file:///c:/Users/lenovo/Documents/Distributed_Task_Processing_Platform/Distributed-Task-Processing-Platform/database.sql).
- Contains table DDL definitions, performance indexes, seed dataset, and complete CRUD query catalog.
- **Copy SQL File** button to copy database code to clipboard.

---

## 🔄 Step-by-Step Usage Guide (End-to-End Walkthrough)

### Scenario A: Processing a Successful Order Event
1. Navigate to the **Pipeline Visualizer** tab.
2. Click **New Order ($149.99)** in the top simulation bar.
3. Watch the **Producers** count increment, the **Queue System** count rise, and an available worker pick up the task (`⚡ BUSY`).
4. Observe the live audit log terminal update with `[EVENTBRIDGE]`, `[QUEUE]`, and `[WORKER]` success logs.

### Scenario B: Testing Failure Retry & Dead-Letter Queue (DLQ) Offloading
1. Go to the **Worker Control** tab.
2. Set the **Artificial Failure Injection Rate** slider to **100%**.
3. Return to **Pipeline Visualizer** and click **Payment Failure (Force DLQ)**.
4. Watch the worker pick up the task, encounter errors, retry with backoff delays, and finally move the task to the **Dead Letter Queue**.
5. Switch to the **SQS & DLQ** tab, select **Dead Letter Queue**, review the failure stack trace, and click **Re-drive to Queue** after resetting the failure slider back to **0%**.

---

## 🗄️ Database Schema & Data Model

The platform uses SQLite operating in **Write-Ahead Logging (WAL)** mode.

### Database Tables Summary:
- **`event_buses`**: Manages EventBridge event buses.
- **`event_rules`**: Defines pattern-matching rules routing events to queues.
- **`events`**: Ingested event records.
- **`queues`**: SQS-style queues storing retry, concurrency, and visibility configurations.
- **`queue_messages`**: Individual task payloads in transit through queues.
- **`dead_letter_queue`**: Stores unrecoverable tasks exceeding `max_retries`.
- **`workers`**: Virtual worker nodes processing tasks.
- **`execution_logs`**: System audit telemetry logs.

---

## ⚙️ Getting Started & Local Setup

### Prerequisites
- **Node.js**: v18.x or higher (Node v24 supported with fallback)
- **npm**: v9.x or higher

### Running Backend Server
```bash
cd server
npm install
npm start
```
*Backend runs on `http://localhost:5000` with WebSockets on `ws://localhost:5000`.*

### Running Frontend Dashboard
```bash
cd client
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---
*Created for Distributed Task Processing & Event-Driven Architecture Demonstrations.*