import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const clients = new Map();

export function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) { ws.close(4001, 'No token'); return; }

      const payload = jwt.verify(token, JWT_SECRET);
      const userId = payload.sub || payload.userId;
      const clinicId = payload.clinicId || payload.clinic_id;

      if (!userId) { ws.close(4002, 'Invalid token'); return; }

      ws._userId = userId;
      ws._clinicId = clinicId;
      ws._isAlive = true;

      if (!clients.has(clinicId)) clients.set(clinicId, new Map());
      clients.get(clinicId).set(userId, ws);

      ws.on('pong', () => { ws._isAlive = true; });

      ws.on('close', () => {
        const clinicClients = clients.get(clinicId);
        if (clinicClients) {
          clinicClients.delete(userId);
          if (clinicClients.size === 0) clients.delete(clinicId);
        }
      });

      ws.send(JSON.stringify({ event: 'connected', data: { userId, clinicId } }));
    } catch (err) {
      ws.close(4003, 'Auth failed');
    }
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws._isAlive) { ws.terminate(); return; }
      ws._isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}

export function broadcast(clinicId, event, data) {
  const clinicClients = clients.get(clinicId);
  if (!clinicClients) return;
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  clinicClients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(message);
  });
}

export function broadcastAll(event, data) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  clients.forEach((clinicClients) => {
    clinicClients.forEach((ws) => {
      if (ws.readyState === 1) ws.send(message);
    });
  });
}
