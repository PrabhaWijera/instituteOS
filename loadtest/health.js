import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },     // Stay at 50
    { duration: '30s', target: 100 },   // Ramp up to 100
    { duration: '1m', target: 100 },    // Stay at 100
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // 95% of requests under 200ms
    http_req_failed: ['rate<0.01'],     // Less than 1% failure rate
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has status ok': (r) => JSON.parse(r.body).status === 'ok',
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(0.5);
}
