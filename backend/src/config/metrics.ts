import * as prometheus from 'prom-client';
import { Request, Response, NextFunction } from 'express';

/**
 * Prometheus metrics collection for NexClass
 * Comprehensive metrics for API, database, cache, external APIs, billing, attendance, etc.
 */

// ===== HTTP Metrics =====
export const httpRequestDuration = new prometheus.Histogram({
  name: 'nexclass_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const httpRequestsTotal = new prometheus.Counter({
  name: 'nexclass_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpActiveConnections = new prometheus.Gauge({
  name: 'nexclass_http_active_connections',
  help: 'Active HTTP connections',
});

// ===== Database Metrics =====
export const dbQueryDuration = new prometheus.Histogram({
  name: 'nexclass_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
});

export const dbQueryErrors = new prometheus.Counter({
  name: 'nexclass_db_query_errors_total',
  help: 'Total database query errors',
  labelNames: ['operation', 'table'],
});

export const dbPoolConnections = new prometheus.Gauge({
  name: 'nexclass_db_pool_connections_current',
  help: 'Current database pool connections',
});

export const dbConnectionErrors = new prometheus.Counter({
  name: 'nexclass_db_connection_errors_total',
  help: 'Total database connection errors',
});

// ===== Redis/Cache Metrics =====
export const redisConnected = new prometheus.Gauge({
  name: 'nexclass_redis_connected',
  help: 'Redis connection status (1=connected, 0=disconnected)',
});

export const redisOperationDuration = new prometheus.Histogram({
  name: 'nexclass_redis_operation_duration_seconds',
  help: 'Redis operation duration',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
});

export const redisErrors = new prometheus.Counter({
  name: 'nexclass_redis_errors_total',
  help: 'Total Redis operation errors',
  labelNames: ['operation'],
});

// ===== Authentication Metrics =====
export const authFailures = new prometheus.Counter({
  name: 'nexclass_auth_failures_total',
  help: 'Total authentication failures',
});

export const authAccountLockouts = new prometheus.Counter({
  name: 'nexclass_auth_account_lockouts_total',
  help: 'Total account lockouts after failed attempts',
});

export const jwtTokensIssued = new prometheus.Counter({
  name: 'nexclass_jwt_tokens_issued_total',
  help: 'Total JWT tokens issued',
  labelNames: ['type'],
});

// ===== External API Metrics =====
export const externalApiCalls = new prometheus.Counter({
  name: 'nexclass_external_api_calls_total',
  help: 'Total external API calls',
  labelNames: ['service', 'status'],
});

export const externalApiCallsFailed = new prometheus.Counter({
  name: 'nexclass_external_api_calls_failed_total',
  help: 'Failed external API calls',
  labelNames: ['service'],
});

export const externalApiDuration = new prometheus.Histogram({
  name: 'nexclass_external_api_duration_seconds',
  help: 'External API call duration',
  labelNames: ['service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// ===== Attendance System Metrics =====
export const attendanceSessionsCreated = new prometheus.Counter({
  name: 'nexclass_attendance_sessions_created_total',
  help: 'Total attendance sessions created',
});

export const attendanceSessionErrors = new prometheus.Counter({
  name: 'nexclass_attendance_session_errors_total',
  help: 'Attendance session errors',
});

export const attendanceOtpExpired = new prometheus.Counter({
  name: 'nexclass_otp_expired_total',
  help: 'Total expired OTPs',
});

export const attendanceMarkingDuration = new prometheus.Histogram({
  name: 'nexclass_attendance_marking_duration_seconds',
  help: 'Time to mark attendance',
  buckets: [0.1, 0.5, 1, 2],
});

export const attendanceRecordsCreated = new prometheus.Counter({
  name: 'nexclass_attendance_records_created_total',
  help: 'Total attendance records created',
  labelNames: ['method'],
});

export const distanceFromGeofence = new prometheus.Histogram({
  name: 'nexclass_attendance_distance_from_geofence_meters',
  help: 'Distance from geofence center in meters',
  buckets: [0, 100, 300, 500, 750, 1000, 2000],
});

// ===== Billing Metrics =====
export const billingJobRuns = new prometheus.Counter({
  name: 'nexclass_billing_job_runs_total',
  help: 'Billing job execution count',
  labelNames: ['status'],
});

export const billingJobLastSuccess = new prometheus.Gauge({
  name: 'nexclass_billing_job_last_success_timestamp_seconds',
  help: 'Unix timestamp of last successful billing job',
});

export const paymentDuesCreated = new prometheus.Counter({
  name: 'nexclass_payment_dues_created_total',
  help: 'Payment dues generated',
});

export const paymentProcessingErrors = new prometheus.Counter({
  name: 'nexclass_payment_processing_errors_total',
  help: 'Payment processing errors',
});

// ===== WebSocket Metrics =====
export const websocketConnections = new prometheus.Gauge({
  name: 'nexclass_websocket_active_connections',
  help: 'Active WebSocket connections',
});

export const websocketConnectionErrors = new prometheus.Counter({
  name: 'nexclass_websocket_connection_errors_total',
  help: 'WebSocket connection errors',
});

// ===== Business Logic Metrics =====
export const enrollmentsCreated = new prometheus.Counter({
  name: 'nexclass_enrollments_created_total',
  help: 'Student enrollments created',
});

export const notificationsSent = new prometheus.Counter({
  name: 'nexclass_notifications_sent_total',
  help: 'Notifications sent',
  labelNames: ['type', 'channel'],
});

export const aiChatMessages = new prometheus.Counter({
  name: 'nexclass_ai_chat_messages_total',
  help: 'AI chat messages processed',
  labelNames: ['direction'],
});

// ===== Middleware to track HTTP metrics =====
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  httpActiveConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const status = res.statusCode;

    httpRequestDuration.observe({ method, route, status }, duration);
    httpRequestsTotal.inc({ method, route, status });
    httpActiveConnections.dec();
  });

  next();
}

// ===== Endpoint to expose metrics =====
export async function metricsEndpoint(req: Request, res: Response) {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
}

export function registerMetrics() {
  console.log('[Observability] Prometheus metrics registered');
}

export default {
  httpRequestDuration,
  httpRequestsTotal,
  httpActiveConnections,
  dbQueryDuration,
  dbQueryErrors,
  dbPoolConnections,
  externalApiCalls,
  externalApiCallsFailed,
  externalApiDuration,
  authFailures,
  attendanceSessionsCreated,
  attendanceMarkingDuration,
  billingJobLastSuccess,
  websocketConnections,
  metricsMiddleware,
  metricsEndpoint,
};

