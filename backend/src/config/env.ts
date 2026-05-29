import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().default('instituteOS <noreply@instituteos.com>'),
  APP_NAME: z.string().default('instituteOS'),
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@nexclass.com'),
  SUPER_ADMIN_PASSWORD: z.string().min(6).default('changeme123'),
  SUPER_ADMIN_NAME: z.string().default('Super Admin'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  SENTRY_DSN: z.string().optional(),
  FRONTEND_URL: z.string().url(),
  CORS_ORIGINS: z.string().optional(),
  BYPASS_GEOFENCING: z.string().default('false'),
  BILLING_CYCLE: z.string().default('30d'),
  BILLING_CRON: z.string().default('*/10 * * * *'),
  // Observability variables
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  ALERT_EMAIL_RECIPIENTS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
