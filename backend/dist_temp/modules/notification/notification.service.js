"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../../config/env");
const email_templates_1 = require("./email.templates");
const logger_1 = __importDefault(require("../../utils/logger"));
// Pool keeps up to 5 concurrent SMTP connections.
// Gmail rate-limits per-connection, pooling queues messages instead of
// hammering with 20 simultaneous connections.
const transporter = nodemailer_1.default.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    host: env_1.env.SMTP_HOST,
    port: parseInt(env_1.env.SMTP_PORT),
    secure: parseInt(env_1.env.SMTP_PORT) === 465,
    auth: {
        user: env_1.env.SMTP_USER,
        pass: env_1.env.SMTP_PASS,
    },
});
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5000, 30000, 120000]; // 5s, 30s, 2min
async function sendWithRetry(to, subject, html, template, attempt = 1) {
    let logId = null;
    try {
        // Create or update DB log record
        const log = await prisma_1.default.emailLog.upsert({
            where: { id: logId ?? '' },
            // id won't match on first attempt so it always creates
            create: { template, to, status: 'retrying', attempts: attempt },
            update: { status: 'retrying', attempts: attempt },
        });
        logId = log.id;
        await transporter.sendMail({ from: env_1.env.EMAIL_FROM, to, subject, html });
        await prisma_1.default.emailLog.update({
            where: { id: log.id },
            data: { status: 'sent', sentAt: new Date(), error: null },
        });
        logger_1.default.info(`[Email] Sent ${template}`, { to, attempt });
    }
    catch (err) {
        const error = err;
        logger_1.default.warn(`[Email] Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${template}`, {
            to,
            error: error.message,
        });
        if (logId) {
            await prisma_1.default.emailLog.update({
                where: { id: logId },
                data: {
                    status: attempt >= MAX_ATTEMPTS ? 'failed' : 'retrying',
                    attempts: attempt,
                    error: error.message,
                },
            });
        }
        if (attempt < MAX_ATTEMPTS) {
            const delay = RETRY_DELAYS_MS[attempt - 1] ?? 5000;
            setTimeout(() => sendWithRetry(to, subject, html, template, attempt + 1), delay);
        }
        else {
            logger_1.default.error(`[Email] Permanently failed after ${MAX_ATTEMPTS} attempts`, {
                template,
                to,
                error: error.message,
            });
        }
    }
}
class NotificationService {
    async getByUser(userId) {
        return prisma_1.default.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async markRead(id, userId) {
        return prisma_1.default.notification.updateMany({
            where: { id, userId },
            data: { isRead: true },
        });
    }
    async markAllRead(userId) {
        return prisma_1.default.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
    async createInApp(data) {
        return prisma_1.default.notification.create({ data });
    }
    // Fire-and-forget: queued through pool, retried up to 3x, logged to DB.
    sendEmail(template, data) {
        try {
            const emailData = email_templates_1.emailTemplates[template](data);
            const to = data.to;
            // Non-blocking — caller does not need to await
            sendWithRetry(to, emailData.subject, emailData.html, template).catch(() => {
                // already logged inside sendWithRetry
            });
        }
        catch (err) {
            const error = err;
            logger_1.default.error('[Email] Template render failed', { template, error: error.message });
        }
    }
}
exports.notificationService = new NotificationService();
