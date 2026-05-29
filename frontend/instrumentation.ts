export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: Sentry } = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      tracesSampleRate: 0.2,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { default: Sentry } = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      tracesSampleRate: 0.2,
    });
  }
}
