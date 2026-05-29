import winston from 'winston';
import * as Sentry from '@sentry/node';

/**
 * Structured logging with Winston
 * Logs are formatted as JSON for easy parsing by Loki/LogStash
 */

const isProduction = process.env.NODE_ENV === 'production';

// Custom JSON format for structured logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.stack == null) {
      log += ` ${JSON.stringify(meta)}`;
    } else if (meta.stack) {
      log += `\n${meta.stack}`;
    }
    return log;
  })
);

const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: isProduction ? jsonFormat : consoleFormat,
  }),
];

// File transport only in production
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: '/var/log/nexclass-error.log',
      level: 'error',
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: '/var/log/nexclass-combined.log',
      format: jsonFormat,
      maxsize: 10485760,
      maxFiles: 10,
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: jsonFormat,
  defaultMeta: {
    service: 'nexclass-backend',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  },
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: '/var/log/nexclass-exceptions.log',
      format: jsonFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: '/var/log/nexclass-rejections.log',
      format: jsonFormat,
    }),
  ],
});

/**
 * Log HTTP requests and responses
 */
export function logRequest(method: string, path: string, duration: number, status: number, userId?: string) {
  const level = status >= 400 ? 'warn' : 'info';
  logger.log(level, `${method} ${path}`, {
    method,
    path,
    duration_ms: duration,
    status_code: status,
    user_id: userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log database operations
 */
export function logDatabaseOperation(
  operation: string,
  table: string,
  duration: number,
  success: boolean,
  rowsAffected?: number,
  error?: string
) {
  const level = success ? 'debug' : 'warn';
  logger.log(level, `Database ${operation}`, {
    operation,
    table,
    duration_ms: duration,
    success,
    rows_affected: rowsAffected,
    error,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log external API calls
 */
export function logExternalApiCall(
  service: string,
  endpoint: string,
  duration: number,
  status: number,
  success: boolean,
  error?: string
) {
  const level = success ? 'debug' : 'warn';
  logger.log(level, `External API call to ${service}`, {
    service,
    endpoint,
    duration_ms: duration,
    status_code: status,
    success,
    error,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  eventType: string,
  userId?: string,
  email?: string,
  success?: boolean,
  reason?: string
) {
  const level = success ? 'info' : 'warn';
  logger.log(level, `Authentication: ${eventType}`, {
    event_type: eventType,
    user_id: userId,
    email,
    success,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log business events (enrollment, payment, attendance, etc)
 */
export function logBusinessEvent(
  eventType: string,
  entityType: string,
  entityId: string,
  userId: string,
  details?: Record<string, any>
) {
  logger.info(`Business event: ${eventType}`, {
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    user_id: userId,
    details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log attendance operations
 */
export function logAttendanceEvent(
  eventType: string,
  sessionId: string,
  studentId: string,
  distance?: number,
  success?: boolean,
  error?: string
) {
  const level = success ? 'info' : 'warn';
  logger.log(level, `Attendance: ${eventType}`, {
    event_type: eventType,
    session_id: sessionId,
    student_id: studentId,
    distance_meters: distance,
    success,
    error,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log errors with Sentry integration
 */
export function logError(message: string, error: Error, context?: Record<string, any>) {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });

  if (isProduction) {
    Sentry.captureException(error, { contexts: { additional: context } });
  }
}

export default logger;

