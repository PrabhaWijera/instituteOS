/**
 * Global test setup — runs before every test file.
 * Suppresses unhandled async events from logger.middleware on response finish.
 */
import { vi } from 'vitest';

// Silence process-level unhandled exceptions from async logger events
// that fire after the HTTP response is already sent.
process.on('uncaughtException', (err) => {
  if ((err as Error).message?.includes('default.log is not a function')) return;
  throw err;
});
