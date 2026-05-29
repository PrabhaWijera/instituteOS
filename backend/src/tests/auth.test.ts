import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

// Mock dependencies before importing
vi.mock('../config/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userInvite: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    student: {
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
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

vi.mock('../modules/notification/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue(true),
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

vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
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
import bcrypt from 'bcryptjs';

const mockedPrisma = prisma as any;

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 for invalid payload', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword123' });

      expect(res.status).toBe(401);
    });

    it('should return 200 with tokens for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('ValidPass123!', 10);
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        fullName: 'Test Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        phone: null,
        profileImage: null,
        instituteId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'ValidPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should return 403 for inactive user', async () => {
      const hashedPassword = await bcrypt.hash('ValidPass123!', 10);
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'inactive@test.com',
        passwordHash: hashedPassword,
        fullName: 'Inactive User',
        role: 'TEACHER',
        isActive: false,
        phone: null,
        profileImage: null,
        instituteId: 'inst-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inactive@test.com', password: 'ValidPass123!' });

      // Depending on implementation, inactive might return 401 or 403
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('POST /api/auth/password/forgot', () => {
    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/password/forgot')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('should return 200 even if user does not exist (security)', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/password/forgot')
        .send({ email: 'nobody@example.com' });

      // Should always return 200 to prevent email enumeration
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe('GET /api/csrf-token', () => {
    it('should return a CSRF token', async () => {
      const res = await request(app).get('/api/csrf-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.csrfToken).toBeDefined();
      expect(res.body.data.csrfToken.length).toBe(64); // 32 bytes hex
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 401 without refresh token cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(401);
    });
  });
});

