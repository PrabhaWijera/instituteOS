'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', gap: 16 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: '#666' }}>An unexpected error occurred. Our team has been notified.</p>
          <button
            onClick={reset}
            style={{ padding: '8px 20px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
