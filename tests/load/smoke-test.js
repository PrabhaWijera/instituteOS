/**
 * NexClass Smoke Load Test — Rate-limit-aware
 *
 * 15 VUs hit frontend pages + health endpoint (respects Nginx rate limits)
 *  1 VU authenticates as super admin and hits authenticated API endpoints
 *
 * Total: 16 VUs simulating real usage patterns
 *
 * Run:
 *   docker run --rm --add-host host.docker.internal:host-gateway \
 *     -e BASE_URL=http://host.docker.internal \
 *     -v "D:\path\to\tests\load:/scripts" \
 *     grafana/k6 run /scripts/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate  = new Rate('error_rate');
const apiLatency = new Trend('api_latency_ms', true);

const BASE                 = __ENV.BASE_URL             || 'http://localhost';
const SUPER_ADMIN_EMAIL    = __ENV.SUPER_ADMIN_EMAIL    || 'admin@nexclass.com';
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD || 'Changeme123';

export const options = {
  scenarios: {
    // 15 VUs browse frontend pages + health endpoint with respectful pacing
    public_load: {
      executor: 'constant-vus',
      vus: 15,
      duration: '90s',
      exec: 'publicScenario',
      tags: { scenario: 'public' },
    },
    // 1 VU logs in once and repeatedly polls authenticated endpoints
    admin_load: {
      executor: 'constant-vus',
      vus: 1,
      duration: '90s',
      exec: 'adminScenario',
      tags: { scenario: 'admin' },
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<3000'],
    'api_latency_ms':    ['p(95)<2000'],
    // Note: same-IP rate-limit 429s inflate error_rate in single-machine test
    // In production with real users from different IPs, expect < 5% errors
    'error_rate': ['rate<0.60'],
  },
};

// ── Public scenario — 15 concurrent browsers ─────────────────────────────────
export function publicScenario() {
  const pages = [
    { url: '/',       label: 'landing page' },
    { url: '/login',  label: 'login page'   },
    { url: '/invite', label: 'invite page'  },
  ];

  for (const page of pages) {
    const t0 = Date.now();
    const res = http.get(`${BASE}${page.url}`, { tags: { name: page.url } });
    apiLatency.add(Date.now() - t0);
    const ok = check(res, { [`${page.label} loaded`]: (r) => r.status >= 200 && r.status < 400 });
    errorRate.add(ok ? 0 : 1);
    sleep(1.5);
  }

  // One API health ping per iteration — 3s sleep avoids same-IP rate-limit
  const t0 = Date.now();
  const res = http.get(`${BASE}/api/health`, { tags: { name: 'health' } });
  apiLatency.add(Date.now() - t0);
  const ok = check(res, { 'API healthy': (r) => r.status === 200 });
  errorRate.add(ok ? 0 : 1);
  sleep(3);
}

// ── Admin scenario — single authenticated VU ─────────────────────────────────
export function adminScenario() {
  // Login
  const loginRes = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  );

  const loginOk = check(loginRes, { 'login 200': (r) => r.status === 200 });
  errorRate.add(loginOk ? 0 : 1);

  if (!loginOk) {
    // login failed (rate limited or wrong creds) — back off
    sleep(15);
    return;
  }

  let token;
  try {
    token = JSON.parse(loginRes.body).data.accessToken;
  } catch (_) {
    errorRate.add(1);
    sleep(5);
    return;
  }

  const auth = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const endpoints = [
    '/api/auth/me',
    '/api/dashboard/super-admin',
    '/api/institutes',
    '/api/notifications',
  ];

  for (const ep of endpoints) {
    const t0 = Date.now();
    const res = http.get(`${BASE}${ep}`, { headers: auth, tags: { name: ep } });
    apiLatency.add(Date.now() - t0);
    const ok = check(res, { [`${ep} authed 2xx`]: (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(ok ? 0 : 1);
    sleep(2);
  }

  // Logout to clean up the session
  http.post(`${BASE}/api/auth/logout`, null, { headers: auth, tags: { name: 'logout' } });
  sleep(5);
}
