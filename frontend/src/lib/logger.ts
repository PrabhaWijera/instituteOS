import * as Sentry from '@sentry/nextjs';

/**
 * Lightweight frontend logger.
 * Wired to Sentry in production for error tracking.
 */
const isProd = process.env.NODE_ENV === 'production';

const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (!isProd) console.info(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
    if (isProd) {
      Sentry.captureMessage(message, { level: 'warning', extra: { args } });
    }
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
    if (isProd) {
      const err = args[0];
      if (err instanceof Error) {
        Sentry.captureException(err, { extra: { message, args: args.slice(1) } });
      } else {
        Sentry.captureMessage(message, { level: 'error', extra: { args } });
      }
    }
  },
};

export default logger;
