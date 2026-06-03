import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { initSentry, Sentry } from './config/sentry';
import { requestLogger } from './middleware/logger.middleware';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { sanitizeInput } from './middleware/sanitize.middleware';
import { metricsMiddleware, metricsEndpoint } from './config/metrics';
import { aiBulkhead, uploadBulkhead, generalBulkhead } from './middleware/bulkhead.middleware';
import { circuitRegistry } from './utils/circuit-breaker';
import { generalUserLimiter } from './middleware/rateLimit.middleware';
import crypto from 'crypto';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Initialize Sentry before anything else
initSentry();

// Versioned routes
import v1Router from './routes/v1';

const app = express();

// Trust the first proxy (Nginx) so that express-rate-limit reads the real
// client IP from X-Forwarded-For instead of the proxy's internal IP.
app.set('trust proxy', 1);

// Metrics endpoint (before all other middleware for performance)
app.get('/metrics', metricsEndpoint);
app.get('/api/metrics', metricsEndpoint);

// Global middleware
app.use(helmet());
// CORS_ORIGINS supports comma-separated list; falls back to FRONTEND_URL
const allowedOrigins = (env.CORS_ORIGINS || env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(metricsMiddleware);
app.use(requestLogger);
app.use(sanitizeInput);
app.use('/api', apiLimiter);

// ---------------------------------------------------------------------------
// Bulkhead isolation — applied per route group BEFORE auth middleware so that
// even the auth check is skipped when the system is overloaded.
// ---------------------------------------------------------------------------

// AI / LLM routes: Groq calls are slow; keep concurrency low
app.use('/api/v1/ai', aiBulkhead);
app.use('/api/ai', aiBulkhead);

// File upload routes: memory + network bound
app.use('/api/v1/materials', uploadBulkhead);
app.use('/api/materials', uploadBulkhead);

// General fallback bulkhead — catches everything else against extreme spikes
app.use('/api', generalBulkhead);

// Per-user rate limit on all authenticated API calls (after bulkhead, before routes)
// Individual routes (e.g. AI) can apply tighter limits on top of this.
app.use('/api', generalUserLimiter);

// ---------------------------------------------------------------------------
// API versioning — deprecation notice on legacy /api/* (non-versioned) routes
// Clients should migrate to /api/v1/*
// ---------------------------------------------------------------------------
const VERSIONED_OR_INTERNAL = ['/v1', '/health', '/csrf', '/docs', '/metrics', '/status'];
app.use('/api', (req, res, next) => {
  const isVersioned = VERSIONED_OR_INTERNAL.some((p) => req.path.startsWith(p));
  if (!isVersioned) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Sat, 01 Jan 2028 00:00:00 GMT');
    res.setHeader('Link', '</api/v1>; rel="successor-version"');
  }
  next();
});

// ---------------------------------------------------------------------------
// Health check — includes circuit breaker states for ops visibility
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  const circuits: Record<string, string> = {};
  circuitRegistry.forEach((cb, name) => {
    circuits[name] = cb.getState();
  });

  const anyOpen = Object.values(circuits).some((s) => s === 'OPEN');

  res.status(anyOpen ? 207 : 200).json({
    status: anyOpen ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    circuits,
    bypassGeofencing: env.BYPASS_GEOFENCING === 'true',
  });
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000,
    path: '/',
  });
  res.status(200).json({ success: true, data: { csrfToken: token } });
});

// API documentation (only in non-production or when explicitly enabled)
if (env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'NexClass API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// Versioned API routes
app.use('/api/v1', v1Router);

// Backward compatibility: /api/* -> /api/v1/*
app.use('/api', v1Router);

// Sentry error handler must be before our custom error handler
if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler (must be last)
app.use(errorHandler);

export default app;
