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
    paymentDue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    paymentRecord: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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

import prisma from '../config/prisma';

const mockedPrisma = prisma as any;

function generateToken(payload: { userId: string; role: string; instituteId?: string }) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'test-access-secret-that-is-long-enough-32chars', { expiresIn: '15m' });
}

describe('Payments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock user lookup for auth middleware
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'teacher-1',
      email: 'teacher@test.com',
      passwordHash: 'hash',
      fullName: 'Test Teacher',
      role: 'TEACHER',
      isActive: true,
      phone: null,
      profileImage: null,
      instituteId: 'inst-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  describe('GET /api/payments (admin list)', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/payments');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/payments/me (student dues)', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/payments/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/payments/:id/record', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/payments/due-1/record')
        .send({ paymentMethod: 'CASH' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/payments/:id/ready', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .patch('/api/payments/due-1/ready');

      expect(res.status).toBe(401);
    });
  });
});

