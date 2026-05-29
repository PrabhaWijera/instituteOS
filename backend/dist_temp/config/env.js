"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('4000'),
    DATABASE_URL: zod_1.z.string().url(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    UPSTASH_REDIS_REST_URL: zod_1.z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: zod_1.z.string().min(1),
    SMTP_HOST: zod_1.z.string().min(1),
    SMTP_PORT: zod_1.z.string().default('587'),
    SMTP_USER: zod_1.z.string().min(1),
    SMTP_PASS: zod_1.z.string().min(1),
    EMAIL_FROM: zod_1.z.string().default('instituteOS <noreply@instituteos.com>'),
    APP_NAME: zod_1.z.string().default('instituteOS'),
    SUPER_ADMIN_EMAIL: zod_1.z.string().email().default('admin@nexclass.com'),
    SUPER_ADMIN_PASSWORD: zod_1.z.string().min(6).default('changeme123'),
    SUPER_ADMIN_NAME: zod_1.z.string().default('Super Admin'),
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().min(1),
    CLOUDINARY_API_KEY: zod_1.z.string().min(1),
    CLOUDINARY_API_SECRET: zod_1.z.string().min(1),
    GROQ_API_KEY: zod_1.z.string().min(1),
    SENTRY_DSN: zod_1.z.string().optional(),
    FRONTEND_URL: zod_1.z.string().url(),
    BYPASS_GEOFENCING: zod_1.z.string().default('false'),
    BILLING_CYCLE_DAYS: zod_1.z.string().default('30'),
    BILLING_CRON: zod_1.z.string().default('*/10 * * * *'),
    // Observability variables
    OTEL_EXPORTER_OTLP_ENDPOINT: zod_1.z.string().optional(),
    ALERT_EMAIL_RECIPIENTS: zod_1.z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
