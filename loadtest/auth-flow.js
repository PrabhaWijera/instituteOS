import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  group('Login Flow', () => {
    // 1. Login
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: __ENV.TEST_EMAIL || 'admin@nexclass.com',
        password: __ENV.TEST_PASSWORD || 'changeme123',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => {
        try {
          return JSON.parse(r.body).data.accessToken !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (loginRes.status !== 200) {
      sleep(1);
      return;
    }

    const token = JSON.parse(loginRes.body).data.accessToken;
    const authHeaders = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    // 2. Get profile
    group('Get Profile', () => {
      const meRes = http.get(`${BASE_URL}/api/v1/auth/me`, authHeaders);
      check(meRes, {
        'profile status is 200': (r) => r.status === 200,
      });
    });

    // 3. Dashboard
    group('Dashboard', () => {
      const dashRes = http.get(`${BASE_URL}/api/v1/dashboard`, authHeaders);
      check(dashRes, {
        'dashboard status is 200 or 403': (r) => r.status === 200 || r.status === 403,
        'dashboard response time < 500ms': (r) => r.timings.duration < 500,
      });
    });

    sleep(1);
  });
}
