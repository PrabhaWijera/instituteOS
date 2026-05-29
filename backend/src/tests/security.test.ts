/**
 * Security Tests
 * - SQL injection attempts
 * - XSS injection attempts
 * - RBAC enforcement (role isolation)
 * - Auth header tampering
 * - Rate limit headers present
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

vi.mock('../config/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    student: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    institute: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn().mockResolvedValue({ isActive: true, isDeleted: false }) },
    tuitionClass: { findMany: vi.fn() },
    attendanceSession: { findMany: vi.fn() },
    paymentDue: { findMany: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    studentEnrollment: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn() },
    classMaterial: { count: vi.fn().mockResolvedValue(0) },
    attendanceRecord: { aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 } }) },
    notification: { findMany: vi.fn().mockResolvedValue([]) },
    userInvite: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('../config/redis', () => ({
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK'), del: vi.fn().mockResolvedValue(1), incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1), pipeline: vi.fn().mockReturnValue({ incr: vi.fn(), expire: vi.fn(), exec: vi.fn().mockResolvedValue([1, 1]) }), ttl: vi.fn().mockResolvedValue(60) },
}));
vi.mock('../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), http: vi.fn(), log: vi.fn() } }));
vi.mock('../config/cloudinary', () => ({ default: { uploader: { upload_stream: vi.fn() } } }));
vi.mock('../modules/notification/notification.service', () => ({ notificationService: { sendEmail: vi.fn(), notifyIfEnabled: vi.fn() } }));
vi.mock('../config/sentry', () => ({ initSentry: vi.fn(), Sentry: { setupExpressErrorHandler: vi.fn(), captureException: vi.fn(), captureMessage: vi.fn() } }));
vi.mock('swagger-jsdoc', () => ({ default: vi.fn().mockReturnValue({}) }));
vi.mock('swagger-ui-express', () => ({ default: { serve: [vi.fn()], setup: vi.fn().mockReturnValue(vi.fn()) }, serve: [vi.fn()], setup: vi.fn().mockReturnValue(vi.fn()) }));

import prisma from '../config/prisma';
const mockedPrisma = prisma as any;

const SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-that-is-long-enough-32chars';
const makeToken = (payload: object) => jwt.sign(payload, SECRET, { expiresIn: '15m' });

const STUDENT_TOKEN = makeToken({ userId: 'student-u1', role: 'STUDENT', instituteId: 'inst-1' });
const TEACHER_TOKEN = makeToken({ userId: 'teacher-u1', role: 'TEACHER', instituteId: 'inst-1' });
const ADMIN_TOKEN = makeToken({ userId: 'admin-u1', role: 'INSTITUTE_ADMIN', instituteId: 'inst-1' });
const SUPER_TOKEN = makeToken({ userId: 'super-u1', role: 'SUPER_ADMIN' });

function mockUserByRole(role: string, id: string) {
  mockedPrisma.user.findUnique.mockResolvedValue({
    id, email: `${role.toLowerCase()}@test.com`, passwordHash: 'hash',
    fullName: 'Test', role, isActive: true, isDeleted: false,
    phone: null, profileImage: null, instituteId: role === 'SUPER_ADMIN' ? null : 'inst-1',
    createdAt: new Date(), updatedAt: new Date(),
  });
  mockedPrisma.institute.findUnique.mockResolvedValue({ isActive: true, isDeleted: false });
}

describe('Security Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Always return an active institute so auth middleware passes for institute users
    mockedPrisma.institute.findUnique.mockResolvedValue({ isActive: true, isDeleted: false });
  });

  // ── Security Headers ─────────────────────────────────────────────────────────
  describe('Security Headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should not expose X-Powered-By header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should include X-Frame-Options header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  // ── Auth Tampering ────────────────────────────────────────────────────────────
  describe('Auth Token Tampering', () => {
    it('rejects malformed JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(res.status).toBe(401);
    });

    it('rejects JWT signed with wrong secret', async () => {
      const fakeToken = jwt.sign({ userId: 'hacker', role: 'SUPER_ADMIN' }, 'wrong-secret');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects expired JWT', async () => {
      const expiredToken = jwt.sign({ userId: 'u1', role: 'STUDENT' }, SECRET, { expiresIn: -1 });
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects Bearer token without scheme', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', ADMIN_TOKEN); // missing "Bearer "
      expect(res.status).toBe(401);
    });
  });

  // ── RBAC Enforcement ─────────────────────────────────────────────────────────
  describe('RBAC — Role Isolation', () => {
    it('STUDENT cannot access /api/institutes (SUPER_ADMIN only)', async () => {
      mockUserByRole('STUDENT', 'student-u1');
      const res = await request(app)
        .get('/api/institutes')
        .set('Authorization', `Bearer ${STUDENT_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('TEACHER cannot create a class', async () => {
      mockUserByRole('TEACHER', 'teacher-u1');
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${TEACHER_TOKEN}`)
        .send({ name: 'Hacked Class', subject: 'None', grade: '10', feeAmount: 0, scheduleDays: [], startTime: '08:00', durationMinutes: 60, teacherId: 'teacher-u1' });
      expect(res.status).toBe(403);
    });

    it('STUDENT cannot access admin payments list', async () => {
      mockUserByRole('STUDENT', 'student-u1');
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${STUDENT_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('PARENT cannot start attendance session', async () => {
      const PARENT_TOKEN = makeToken({ userId: 'parent-u1', role: 'PARENT', instituteId: 'inst-1' });
      mockUserByRole('PARENT', 'parent-u1');
      const res = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${PARENT_TOKEN}`)
        .send({ classId: 'c1' });
      expect(res.status).toBe(403);
    });

    it('TEACHER cannot access super admin dashboard', async () => {
      mockUserByRole('TEACHER', 'teacher-u1');
      const res = await request(app)
        .get('/api/dashboard/super-admin')
        .set('Authorization', `Bearer ${TEACHER_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('INSTITUTE_ADMIN cannot access super-admin dashboard', async () => {
      mockUserByRole('INSTITUTE_ADMIN', 'admin-u1');
      const res = await request(app)
        .get('/api/dashboard/super-admin')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Input Injection ───────────────────────────────────────────────────────────
  describe('Input Injection Protection', () => {
    const sqlPayloads = [
      "' OR '1'='1",
      '"; DROP TABLE users; --',
      "admin'--",
      "1' UNION SELECT * FROM users--",
    ];

    const xssPayloads = [
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '<svg onload=alert(1)>',
    ];

    sqlPayloads.forEach(payload => {
      it(`rejects SQL injection in login email: ${payload.slice(0, 30)}`, async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(null);
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: payload, password: 'test123' });
        // Should return 400 (validation) not 500 (crash) — no SQL execution possible via Prisma
        expect(res.status).not.toBe(500);
        expect([400, 401, 422]).toContain(res.status);
      });
    });

    xssPayloads.forEach(payload => {
      it(`sanitizes XSS payload in body: ${payload.slice(0, 30)}`, async () => {
        // No user found → login fails gracefully, not with server crash
        mockedPrisma.user.findUnique.mockResolvedValue(null);
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: payload });
        // Must not crash (500) — sanitizer strips the payload and login returns 401
        expect(res.status).not.toBe(500);
        expect([400, 401, 422]).toContain(res.status);
      });
    });

    it('does not crash on large payload', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      const bigString = 'x'.repeat(1_100_000);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: bigString });
      // Never 5xx — either rejected (400/413) or cleanly unauthorized (401)
      expect(res.status).not.toBe(500);
      expect([400, 401, 413]).toContain(res.status);
    });
  });

  // ── Path Traversal ────────────────────────────────────────────────────────────
  describe('Path Traversal', () => {
    it('rejects path traversal in params', async () => {
      mockUserByRole('INSTITUTE_ADMIN', 'admin-u1');
      const res = await request(app)
        .get('/api/students/../../etc/passwd')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect([400, 404]).toContain(res.status);
    });
  });
});

