import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

// Mock dependencies
vi.mock('../config/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    attendanceSession: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    attendanceRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    tuitionClass: {
      findFirst: vi.fn(),
    },
    student: {
      findFirst: vi.fn(),
    },
    studentEnrollment: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../config/redis', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

vi.mock('../config/cloudinary', () => ({
  default: { uploader: { upload_stream: vi.fn() } },
}));

vi.mock('../modules/notification/notification.service', () => ({
  notificationService: {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendNotification: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../config/sentry', () => ({
  initSentry: vi.fn(),
  Sentry: {
    setupExpressErrorHandler: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  },
}));

vi.mock('swagger-jsdoc', () => ({ default: vi.fn().mockReturnValue({}) }));
vi.mock('swagger-ui-express', () => ({
  default: { serve: [vi.fn(), vi.fn()], setup: vi.fn().mockReturnValue(vi.fn()) },
  serve: [vi.fn(), vi.fn()],
  setup: vi.fn().mockReturnValue(vi.fn()),
}));

function generateToken(payload: { userId: string; role: string; instituteId?: string }) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'test-access-secret-that-is-long-enough-32chars', { expiresIn: '15m' });
}

describe('Attendance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/attendance/sessions', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/attendance/sessions')
        .send({ classId: 'class-1' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/attendance/verify-otp', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/attendance/verify-otp')
        .send({ classId: 'class-1', otpCode: '123456' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/attendance/sessions', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/attendance/sessions');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/attendance/history/me', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/attendance/history/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/attendance/sessions/:id/end', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).patch('/api/attendance/sessions/session-1/end');
      expect(res.status).toBe(401);
    });
  });
});

