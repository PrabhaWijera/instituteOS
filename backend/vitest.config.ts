import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    include: ['**/*.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-32chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough-32chars',
      UPSTASH_REDIS_REST_URL: 'https://fake-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'fake-token',
      SMTP_HOST: 'smtp.test.com',
      SMTP_PORT: '587',
      SMTP_USER: 'test@test.com',
      SMTP_PASS: 'testpass',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      GROQ_API_KEY: 'test-groq-key',
      FRONTEND_URL: 'http://localhost:3000',
      BYPASS_GEOFENCING: 'true',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
