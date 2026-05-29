import { CircuitBreaker, registerCircuit } from '../utils/circuit-breaker';

/**
 * Groq AI circuit breaker.
 * Opens after 5 consecutive failures; probes after 60 s.
 * Each call has a 20 s timeout (LLM calls can be slow).
 */
export const groqCircuit = registerCircuit(
  new CircuitBreaker({
    name: 'groq-ai',
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 60_000,
    callTimeoutMs: 20_000,
  }),
);

/**
 * Cloudinary circuit breaker.
 * Opens after 5 consecutive failures; probes after 60 s.
 * Upload calls are bounded to 30 s (large PDFs).
 */
export const cloudinaryCircuit = registerCircuit(
  new CircuitBreaker({
    name: 'cloudinary',
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 60_000,
    callTimeoutMs: 30_000,
  }),
);

/**
 * SMTP / email circuit breaker.
 * Looser thresholds — email delivery is non-critical for real-time flows.
 */
export const emailCircuit = registerCircuit(
  new CircuitBreaker({
    name: 'smtp-email',
    failureThreshold: 3,
    successThreshold: 1,
    timeoutMs: 120_000,
    callTimeoutMs: 10_000,
  }),
);
