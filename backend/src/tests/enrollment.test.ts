import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

vi.mock('../config/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    student: { findFirst: vi.fn() },
    institute: { findUnique: vi.fn().mockResolvedValue({ isActive: true, isDeleted: false }) },
    tuitionClass: { findFirst: vi.fn(), findMany: vi.fn() },
    studentEnrollment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    instituteSettings: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
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
const mp = prisma as any;

const SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-that-is-long-enough-32chars';
const makeToken = (payload: object) => jwt.sign(payload, SECRET, { expiresIn: '15m' });

const ADMIN_TOKEN   = makeToken({ userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'INSTITUTE_ADMIN', instituteId: 'inst-1' });
const STUDENT_TOKEN = makeToken({ userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role: 'STUDENT',          instituteId: 'inst-1' });
const TEACHER_TOKEN = makeToken({ userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', role: 'TEACHER',          instituteId: 'inst-1' });

const STUDENT_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const CLASS_UUID   = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

const userStub = (role: string, id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') => ({
  id, email: `${role.toLowerCase()}@test.com`, passwordHash: 'hash', fullName: 'Test User',
  role, isActive: true, phone: null, profileImage: null, instituteId: 'inst-1',
  isDeleted: false, createdAt: new Date(), updatedAt: new Date(),
});

describe('Enrollment API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default institute mock must persist across all tests
    mp.institute.findUnique.mockResolvedValue({ isActive: true, isDeleted: false });
  });

  describe('POST /api/enrollments', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/enrollments').send({ studentId: 's1', classId: 'c1' });
      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT role', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('STUDENT', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
      const res = await request(app)
        .post('/api/enrollments')
        .set('Authorization', `Bearer ${STUDENT_TOKEN}`)
        .send({ studentId: STUDENT_UUID, classId: CLASS_UUID });
      expect(res.status).toBe(403);
    });

    it('returns 403 for TEACHER role', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('TEACHER', 'cccccccc-cccc-cccc-cccc-cccccccccccc'));
      const res = await request(app)
        .post('/api/enrollments')
        .set('Authorization', `Bearer ${TEACHER_TOKEN}`)
        .send({ studentId: STUDENT_UUID, classId: CLASS_UUID });
      expect(res.status).toBe(403);
    });

    it('returns 400 for missing fields', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('INSTITUTE_ADMIN'));
      const res = await request(app)
        .post('/api/enrollments')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 when student not found', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('INSTITUTE_ADMIN'));
      mp.student.findFirst.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/enrollments')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ studentId: STUDENT_UUID, classId: CLASS_UUID });
      expect([404, 400]).toContain(res.status);
    });

    it('returns 409 when student already enrolled', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('INSTITUTE_ADMIN'));
      mp.student.findFirst.mockResolvedValue({ id: STUDENT_UUID, userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', instituteId: 'inst-1', isDeleted: false });
      mp.tuitionClass.findFirst.mockResolvedValue({ id: CLASS_UUID, instituteId: 'inst-1', isDeleted: false, maxCapacity: null, feeAmount: 1500, name: 'Maths', teacherId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' });
      mp.studentEnrollment.findUnique.mockResolvedValue({ id: 'fffffff0-ffff-ffff-ffff-ffffffffffff', subscriptionStatus: 'ACTIVE' });
      const res = await request(app)
        .post('/api/enrollments')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ studentId: STUDENT_UUID, classId: CLASS_UUID });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/enrollments', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/enrollments');
      expect(res.status).toBe(401);
    });

    it('returns 200 for admin', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('INSTITUTE_ADMIN', 'admin-1'));
      mp.studentEnrollment.findMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/enrollments')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/enrollments/student/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/enrollments/student/s1');
      expect(res.status).toBe(401);
    });

    it('returns 403 when student accesses another student enrollments', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('STUDENT', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
      const res = await request(app)
        .get('/api/enrollments/student/dddddddd-dddd-dddd-dddd-dddddddddddd')
        .set('Authorization', `Bearer ${STUDENT_TOKEN}`);
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/enrollments/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/enrollments/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
      expect(res.status).toBe(401);
    });

    it('returns 403 for TEACHER', async () => {
      mp.user.findUnique.mockResolvedValue(userStub('TEACHER', 'cccccccc-cccc-cccc-cccc-cccccccccccc'));
      const res = await request(app)
        .delete('/api/enrollments/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
        .set('Authorization', `Bearer ${TEACHER_TOKEN}`);
      expect(res.status).toBe(403);
    });
  });
});

