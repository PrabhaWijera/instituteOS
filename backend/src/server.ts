// Initialize tracing FIRST, before anything else
import { initTracing } from './config/tracing';
initTracing();

import http from 'http';
import WebSocket from 'ws';
import app from './app';
import { env } from './config/env';
import { startBillingWorker } from './modules/payment/billing.worker';
import { startRetentionWorker } from './workers/retention.worker';
import { sessionClients, subscribeAttendanceBroadcasts } from './modules/attendance/websocket.handler';
import { verifyAccessToken } from './utils/jwt';
import logger from './utils/logger';

const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws/attendance' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const sessionId = url.searchParams.get('sessionId');

  if (!token || !sessionId) {
    ws.close(4001, 'Missing token or sessionId');
    return;
  }

  try {
    verifyAccessToken(token);
  } catch {
    ws.close(4003, 'Invalid token');
    return;
  }

  // Register client for session
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set());
  }
  sessionClients.get(sessionId)!.add(ws);

  ws.send(JSON.stringify({ type: 'CONNECTED', sessionId }));

  ws.on('close', () => {
    sessionClients.get(sessionId)?.delete(ws);
    if (sessionClients.get(sessionId)?.size === 0) {
      sessionClients.delete(sessionId);
    }
  });

  ws.on('error', () => {
    sessionClients.get(sessionId)?.delete(ws);
  });
});

// Start billing worker
startBillingWorker();

// Start nightly data retention worker (GDPR/compliance)
startRetentionWorker();

// Subscribe to Redis attendance broadcasts (for horizontal scaling)
subscribeAttendanceBroadcasts();

// Start server
const PORT = parseInt(env.PORT, 10);
server.listen(PORT, () => {
  logger.info(`NexClass API running on port ${PORT}`);
  logger.info(`WebSocket server running on ws://localhost:${PORT}/ws/attendance`);
  logger.info('Billing worker started (every 10 minutes)');
  logger.info('Retention worker started (nightly at 02:00 UTC)');
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

export default server;
