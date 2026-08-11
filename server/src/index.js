import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db.js';
import { initWebSocketServer } from './wsServer.js';
import { startWorkerPool } from './workerPool.js';
import apiRouter from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON Parsers
app.use(cors());
app.use(express.json());

// Initialize Database Schema from database.sql
initDB();

// Attach API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
initWebSocketServer(server);

// Start Background Queue Workers
startWorkerPool();

server.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(` MINI AWS EVENTBRIDGE + QUEUE SYSTEM BACKEND RUNNING `);
  console.log(` HTTP Server: http://localhost:${PORT}`);
  console.log(` Telemetry WebSocket: ws://localhost:${PORT}`);
  console.log(`==========================================================`);
});
