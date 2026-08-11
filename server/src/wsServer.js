import { WebSocketServer } from 'ws';

let wss = null;

export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    // Send welcome connection message
    ws.send(JSON.stringify({ type: 'CONNECTED', data: { message: 'Real-time telemetry stream connected' } }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch (e) {
        // ignore invalid ping/pong
      }
    });
  });

  console.log(' WebSocket Server initialized for real-time telemetry');
}

export function broadcast(payload) {
  if (!wss) return;
  const messageStr = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(messageStr);
    }
  });
}
