import prisma from '../../config/prisma';
import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { emailTemplates } from './email.templates';
import logger from '../../utils/logger';

// Pool keeps up to 5 concurrent SMTP connections.
// Gmail rate-limits per-connection, pooling queues messages instead of
// hammering with 20 simultaneous connections.
const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT),
  secure: parseInt(env.SMTP_PORT) === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000]; // 5s, 30s, 2min

async function sendWithRetry(
  to: string,
  subject: string,
  html: string,
  template: string,
  attempt = 1
): Promise<void> {
  let logId: string | null = null;

  try {
    // Create or update DB log record
    const log = await prisma.emailLog.upsert({
      where: { id: logId ?? '' },
      // id won't match on first attempt so it always creates
      create: { template, to, status: 'retrying', attempts: attempt },
      update: { status: 'retrying', attempts: attempt },
    });
    logId = log.id;

    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'sent', sentAt: new Date(), error: null },
    });

    logger.info(`[Email] Sent ${template}`, { to, attempt });
  } catch (err) {
    const error = err as Error;
    logger.warn(`[Email] Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${template}`, {
      to,
      error: error.message,
    });

    if (logId) {
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: attempt >= MAX_ATTEMPTS ? 'failed' : 'retrying',
          attempts: attempt,
          error: error.message,
        },
      });
    }

    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 5_000;
      setTimeout(() => sendWithRetry(to, subject, html, template, attempt + 1), delay);
    } else {
      logger.error(`[Email] Permanently failed after ${MAX_ATTEMPTS} attempts`, {
        template,
        to,
        error: error.message,
      });
    }
  }
}

class NotificationService {
  async getByUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async createInApp(data: {
    userId: string;
    instituteId?: string;
    title: string;
    message: string;
    type: string;
  }) {
    return prisma.notification.create({ data });
  }

  /**
   * Create an in-app notification only if the institute's settings allow it.
   * settingKey maps to a boolean column on InstituteSettings.
   * If no instituteId is given, the notification is always created.
   */
  async notifyIfEnabled(
    settingKey: 'notifyAbsent' | 'notifyFeeDue' | 'notifyEnrollment' | 'notifyParentInvite' | 'notifyPaymentReceipt' | null,
    data: { userId: string; instituteId: string; title: string; message: string; type: string }
  ) {
    if (settingKey) {
      const settings = await prisma.instituteSettings.findUnique({ where: { instituteId: data.instituteId } });
      if (settings && settings[settingKey] === false) return; // setting disabled
    }
    await prisma.notification.create({ data }).catch((err) => {
      logger.warn('[Notification] Failed to create in-app notification', { error: (err as Error).message });
    });
  }

  // Fire-and-forget: queued through pool, retried up to 3x, logged to DB.
  sendEmail(template: keyof typeof emailTemplates, data: Record<string, unknown>): void {
    try {
      const emailData = (emailTemplates[template] as (d: unknown) => { subject: string; html: string })(data);
      const to = data.to as string;
      // Non-blocking — caller does not need to await
      sendWithRetry(to, emailData.subject, emailData.html, template).catch(() => {
        // already logged inside sendWithRetry
      });
    } catch (err) {
      const error = err as Error;
      logger.error('[Email] Template render failed', { template, error: error.message });
    }
  }
}

export const notificationService = new NotificationService();
