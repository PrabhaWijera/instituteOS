/**
 * NexClass Load Test — 25 Concurrent Users
 * Uses k6 (https://k6.io)
 *
 * User breakdown (25 total):
 *   10 Students  — check fees, attendance history, classes
 *    7 Teachers  — list sessions, get class details, reports
 *    5 Parents   — view child attendance, fees
 *    3 Admins    — list students, payments dashboard
 *
 * Run:
 *   docker run --rm --network nexclass_nexclass \
 *     -e BASE_URL=http://nexclass-nginx \
 *     -e ADMIN_EMAIL=admin@yourinstitute.com \
 *     -e ADMIN_PASSWORD=yourpassword \
 *     ... (see README) \
 *     grafana/k6 run /scripts/load-test.js \
 *     -v /path/to/tests/load:/scripts
 *
 * Or against localhost (outside Docker):
 *   k6 run tests/load/load-test.js -e BASE_URL=http://localhost
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const loginErrors   = new Counter('login_errors');
const apiErrors     = new Counter('api_errors');
const errorRate     = new Rate('error_rate');
const loginDuration = new Trend('login_duration_ms', true);
const apiDuration   = new Trend('api_duration_ms', true);

// ── Config ────────────────────────────────────────────────────────────────────
const BASE = __ENV.BASE_URL || 'http://localhost';

// Test accounts — set via env vars or defaults for local dev
const ACCOUNTS = {
  students: Array.from({ length: 10 }, (_, i) => ({
    email: __ENV[`STUDENT_EMAIL_${i + 1}`] || `student${i + 1}@test.com`,
    password: __ENV[`STUDENT_PASSWORD_${i + 1}`] || 'TestPass123!',
  })),
  teachers: Array.from({ length: 7 }, (_, i) => ({
    email: __ENV[`TEACHER_EMAIL_${i + 1}`] || `teacher${i + 1}@test.com`,
    password: __ENV[`TEACHER_PASSWORD_${i + 1}`] || 'TestPass123!',
  })),
  parents: Array.from({ length: 5 }, (_, i) => ({
    email: __ENV[`PARENT_EMAIL_${i + 1}`] || `parent${i + 1}@test.com`,
    password: __ENV[`PARENT_PASSWORD_${i + 1}`] || 'TestPass123!',
  })),
  admins: Array.from({ length: 3 }, (_, i) => ({
    email: __ENV[`ADMIN_EMAIL_${i + 1}`] || `admin${i + 1}@test.com`,
    password: __ENV[`ADMIN_PASSWORD_${i + 1}`] || 'TestPass123!',
  })),
};

// ── Test Stages ───────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    students: {
      executor: 'constant-vus',
      vus: 10,
      duration: '3m',
      exec: 'studentScenario',
      tags: { role: 'student' },
    },
    teachers: {
      executor: 'constant-vus',
      vus: 7,
      duration: '3m',
      exec: 'teacherScenario',
      tags: { role: 'teacher' },
    },
    parents: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
      exec: 'parentScenario',
      tags: { role: 'parent' },
    },
    admins: {
      executor: 'constant-vus',
      vus: 3,
      duration: '3m',
      exec: 'adminScenario',
      tags: { role: 'admin' },
    },
  },
  thresholds: {
    // 95% of all requests must complete within 2s
    'http_req_duration': ['p(95)<2000'],
    // API-specific: 99% within 3s
    'api_duration_ms': ['p(99)<3000'],
    // Error rate under 5%
    'error_rate': ['rate<0.05'],
    // Login within 3s
    'login_duration_ms': ['p(95)<3000'],
  },
};

// ── Helper: Login ─────────────────────────────────────────────────────────────
function login(email, password) {
  const start = Date.now();
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });
  loginDuration.add(Date.now() - start);

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => {
      try { return JSON.parse(r.body).data?.accessToken !== undefined; } catch { return false; }
    },
  });

  if (!ok || res.status !== 200) {
    loginErrors.add(1);
    errorRate.add(1);
    return null;
  }
  errorRate.add(0);
  return JSON.parse(res.body).data.accessToken;
}

function authHeaders(token) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function apiGet(url, token, name) {
  const start = Date.now();
  const res = http.get(`${BASE}${url}`, { headers: authHeaders(token), tags: { name } });
  apiDuration.add(Date.now() - start);
  const ok = check(res, { [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  if (!ok) apiErrors.add(1);
  errorRate.add(ok ? 0 : 1);
  return res;
}

// ── Student Scenario ──────────────────────────────────────────────────────────
export function studentScenario() {
  const idx = (__VU - 1) % ACCOUNTS.students.length;
  const account = ACCOUNTS.students[idx];

  const token = login(account.email, account.password);
  if (!token) { sleep(5); return; }

  group('student — check classes', () => {
    apiGet('/api/classes', token, 'student_classes');
    sleep(1);
  });

  group('student — check fees', () => {
    apiGet('/api/payments/me', token, 'student_fees');
    sleep(1);
  });

  group('student — check attendance history', () => {
    apiGet('/api/attendance/history/me', token, 'student_attendance');
    sleep(1);
  });

  group('student — check notifications', () => {
    apiGet('/api/notifications', token, 'student_notifications');
    sleep(1);
  });

  group('student — check dashboard', () => {
    apiGet('/api/dashboard/student', token, 'student_dashboard');
    sleep(1);
  });

  sleep(2);
}

// ── Teacher Scenario ──────────────────────────────────────────────────────────
export function teacherScenario() {
  const idx = (__VU - 1) % ACCOUNTS.teachers.length;
  const account = ACCOUNTS.teachers[idx];

  const token = login(account.email, account.password);
  if (!token) { sleep(5); return; }

  group('teacher — list classes', () => {
    apiGet('/api/classes/my', token, 'teacher_classes');
    sleep(1);
  });

  group('teacher — list sessions', () => {
    apiGet('/api/attendance/sessions', token, 'teacher_sessions');
    sleep(1);
  });

  group('teacher — dashboard', () => {
    apiGet('/api/dashboard/teacher', token, 'teacher_dashboard');
    sleep(1);
  });

  group('teacher — notifications', () => {
    apiGet('/api/notifications', token, 'teacher_notifications');
    sleep(1);
  });

  sleep(2);
}

// ── Parent Scenario ───────────────────────────────────────────────────────────
export function parentScenario() {
  const idx = (__VU - 1) % ACCOUNTS.parents.length;
  const account = ACCOUNTS.parents[idx];

  const token = login(account.email, account.password);
  if (!token) { sleep(5); return; }

  group('parent — list children', () => {
    const res = apiGet('/api/parent/children', token, 'parent_children');

    // If children exist, drill into their data
    try {
      const children = JSON.parse(res.body).data || [];
      if (children.length > 0) {
        const childId = children[0].id;

        group('parent — child attendance', () => {
          apiGet(`/api/parent/children/${childId}/attendance`, token, 'parent_child_attendance');
          sleep(0.5);
        });

        group('parent — child payments', () => {
          apiGet(`/api/parent/children/${childId}/payments`, token, 'parent_child_payments');
          sleep(0.5);
        });
      }
    } catch (_) {}
    sleep(1);
  });

  group('parent — notifications', () => {
    apiGet('/api/notifications', token, 'parent_notifications');
    sleep(1);
  });

  sleep(2);
}

// ── Admin Scenario ────────────────────────────────────────────────────────────
export function adminScenario() {
  const idx = (__VU - 1) % ACCOUNTS.admins.length;
  const account = ACCOUNTS.admins[idx];

  const token = login(account.email, account.password);
  if (!token) { sleep(5); return; }

  group('admin — dashboard', () => {
    apiGet('/api/dashboard/admin', token, 'admin_dashboard');
    sleep(1);
  });

  group('admin — list students', () => {
    apiGet('/api/students', token, 'admin_students');
    sleep(1);
  });

  group('admin — list classes', () => {
    apiGet('/api/classes', token, 'admin_classes');
    sleep(1);
  });

  group('admin — payments', () => {
    apiGet('/api/payments', token, 'admin_payments');
    sleep(1);
  });

  group('admin — enrollments', () => {
    apiGet('/api/enrollments', token, 'admin_enrollments');
    sleep(1);
  });

  sleep(2);
}
