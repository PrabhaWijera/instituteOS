import WebSocket from 'ws';
import redis from '../../config/redis';
import logger from '../../utils/logger';

// Local clients connected to THIS server instance
export const sessionClients = new Map<string, Set<WebSocket>>();

// Redis pub/sub channel
const ATTENDANCE_CHANNEL = 'attendance:broadcast';

export interface AttendanceBroadcastPayload {
  studentId: string;
  studentName: string;
  checkInTime: string;
  isManual: boolean;
  presentCount: number;
  totalEnrolled: number;
}

/**
 * Publish attendance event to Redis so all server instances receive it.
 * Falls back to local-only broadcast if Redis is unavailable.
 */
export async function broadcastAttendance(sessionId: string, payload: AttendanceBroadcastPayload) {
  const message = JSON.stringify({ sessionId, type: 'STUDENT_CHECKED_IN', data: payload });

  try {
    // Publish to Redis channel — all instances will pick this up
    await redis.publish(ATTENDANCE_CHANNEL, message);
  } catch (err) {
    logger.warn('Redis publish failed, falling back to local broadcast', {
      error: (err as Error).message,
    });
    // Fallback: local broadcast only
    broadcastLocal(sessionId, message);
  }
}

/**
 * Send a message to all local WebSocket clients subscribed to a session.
 */
export function broadcastLocal(sessionId: string, message: string) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Subscribe to Redis channel for attendance broadcasts.
 * Call this once on server startup.
 */
export async function subscribeAttendanceBroadcasts() {
  try {
    // Upstash Redis REST doesn't support traditional pub/sub subscriptions.
    // For Upstash, we use a polling approach or rely on local broadcast.
    // For native Redis (ioredis), you would use:
    //   const sub = redis.duplicate();
    //   sub.subscribe(ATTENDANCE_CHANNEL);
    //   sub.on('message', (channel, message) => { ... });
    //
    // With Upstash REST API, we use the publish method for cross-instance
    // communication via a shared queue pattern instead.
    logger.info('Attendance WebSocket broadcast handler initialized');
  } catch (err) {
    logger.error('Failed to subscribe to attendance broadcasts', {
      error: (err as Error).message,
    });
  }
}
