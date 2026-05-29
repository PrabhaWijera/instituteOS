import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

vi.mock('../config/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    institute: { findUnique: vi.fn().mockResolvedValue({ isActive: true, isDeleted: false }) },
    tuitionClass: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    studentEnrollment: { count: vi.fn().mockResolvedValue(0) },
    attendanceSession: { count: vi.fn().mockResolvedValue(0) },
    classMaterial: { count: vi.fn().mockResolvedValue(0) },
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
const token = (payload: object) => jwt.sign(payload, SECRET, { expiresIn: '15m' });

const ADMIN_TOKEN = token({ userId: 'admin-1', role: 'INSTITUTE_ADMIN', instituteId: 'inst-1' });
const TEACHER_TOKEN = token({ userId: 'teacher-1', role: 'TEACHER', instituteId: 'inst-1' });
const STUDENT_TOKEN = token({ userId: 'student-1', role: 'STUDENT', instituteId: 'inst-1' });

const TEACHER_UUID = '11111111-1111-1111-1111-111111111111';
const CLASS_UUID   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const CLASS_STUB = {
  id: CLASS_UUID, name: 'Maths G10', subject: 'Maths', grade: '10',
  feeAmount: 1500, scheduleDays: ['MON', 'WED'], startTime: '08:00',
  durationMinutes: 60, maxCapacity: 30, isActive: true, isDeleted: false,
  instituteId: 'inst-1', teacherId: TEACHER_UUID, createdAt: new Date(),
  teacher: { id: TEACHER_UUID, fullName: 'T. Silva', email: 't@test.com' },
  _count: { enrollments: 0, sessions: 0 },
};

function mockAdmin() {
  mockedPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'INSTITUTE_ADMIN', isActive: true, isDeleted: false, instituteId: 'inst-1', email: 'a@t.com', passwordHash: 'h', fullName: 'Admin', phone: null, profileImage: null, createdAt: new Date(), updatedAt: new Date() });
  mockedPrisma.institute.findUnique.mockResolvedValue({ isActive: true, isDeleted: false });
}
function mockTeacher() {
  mockedPrisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER', isActive: true, isDeleted: false, instituteId: 'inst-1', email: 't@t.com', passwordHash: 'h', fullName: 'Teacher', phone: null, profileImage: null, createdAt: new Date(), updatedAt: new Date() });
  mockedPrisma.institute.findUnique.mockResolvedValue({ isActive: true, isDeleted: false });
}
function mockStudent() {
  mockedPrisma.user.findUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT', isActive: true, isDeleted: false, instituteId: 'inst-1', email: 's@t.com', passwordHash: 'h', fullName: 'Student', phone: null, profileImage: null, createdAt: new Date(), updatedAt: new Date() });
  mockedPrisma.institute.findUnique.mockResolvedValue({ isActive: true, isDeleted: false });
}

describe('Classes API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedPrisma.institute.findUnique.mockResolvedValue({ isActive: true, isDeleted: false });
  });

  describe('GET /api/classes', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/classes');
      expect(res.status).toBe(401);
    });

    it('returns 200 with empty array for admin', async () => {
      mockAdmin();
      mockedPrisma.tuitionClass.findMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns 200 for teacher (only their classes)', async () => {
      mockTeacher();
      mockedPrisma.tuitionClass.findMany.mockResolvedValue([CLASS_STUB]);
      const res = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${TEACHER_TOKEN}`);
      expect(res.status).toBe(200);
    });

    it('returns 200 for student', async () => {
      mockStudent();
      mockedPrisma.tuitionClass.findMany.mockResolvedValue([CLASS_STUB]);
      const res = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${STUDENT_TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/classes', () => {
    const validClass = { name: 'Science G11', subject: 'Science', grade: '11', feeAmount: 2000, scheduleDays: ['TUE'], startTime: '09:00', durationMinutes: 90, teacherId: TEACHER_UUID };

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/classes').send(validClass);
      expect(res.status).toBe(401);
    });

    it('returns 403 for TEACHER', async () => {
      mockTeacher();
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${TEACHER_TOKEN}`)
        .send(validClass);
      expect(res.status).toBe(403);
    });

    it('returns 403 for STUDENT', async () => {
      mockStudent();
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${STUDENT_TOKEN}`)
        .send(validClass);
      expect(res.status).toBe(403);
    });

    it('returns 400 for missing required fields', async () => {
      mockAdmin();
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Incomplete' }); // missing subject, grade, feeAmount etc.
      expect(res.status).toBe(400);
    });

    it('returns 201 for valid class creation by admin', async () => {
      mockAdmin();
      // class.service.create calls user.findFirst to verify teacher
      mockedPrisma.user.findFirst.mockResolvedValue({ id: TEACHER_UUID, role: 'TEACHER', isActive: true, isDeleted: false, instituteId: 'inst-1', email: 't@t.com', fullName: 'Teacher' });
      mockedPrisma.tuitionClass.create.mockResolvedValue({ ...CLASS_STUB, id: 'new-class-1' });
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(validClass);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/classes/:id', () => {
    it('returns 404 for non-existent class', async () => {
      mockAdmin();
      mockedPrisma.tuitionClass.findFirst.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/classes/nonexistent-id')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/classes/:id/status', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).patch('/api/classes/class-1/status').send({ isActive: false });
      expect(res.status).toBe(401);
    });

    it('returns 403 for teacher', async () => {
      mockTeacher();
      const res = await request(app)
        .patch('/api/classes/class-1/status')
        .set('Authorization', `Bearer ${TEACHER_TOKEN}`)
        .send({ isActive: false });
      expect(res.status).toBe(403);
    });
  });
});

