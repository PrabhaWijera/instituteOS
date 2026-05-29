import cron from 'node-cron';
import prisma from '../config/prisma';
import logger from '../utils/logger';

/**
 * Data Retention Worker
 *
 * Runs nightly at 02:00 UTC and enforces the platform data retention policy:
 *
 * | Data category                  | Retention   | Action              |
 * |-------------------------------|-------------|---------------------|
 * | AI chat messages               | 1 year      | Hard delete         |
 * | Expired / stale notifications  | 90 days     | Hard delete         |
 * | Expired refresh tokens         | 30 days     | Hard delete         |
 * | Expired user invites           | 30 days     | Hard delete         |
 * | Soft-deleted user records      | 2 years     | Hard delete         |
 * | Completed attendance sessions  | 2 years     | Hard delete         |
 *
 * All deletions are logged with counts for audit purposes.
 */
export function startRetentionWorker() {
  // Run every night at 02:00 UTC
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Retention] Starting nightly data retention cycle');

    const now = new Date();

    const results: Record<string, number> = {};

    // ------------------------------------------------------------------
    // 1. AI chat messages older than 1 year
    // ------------------------------------------------------------------
    try {
      const cutoff = new Date(now);
      cutoff.setFullYear(cutoff.getFullYear() - 1);

      const deleted = await prisma.aiChatMessage.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      results.aiChatMessages = deleted.count;
    } catch (err) {
      logger.error('[Retention] Failed to purge AI chat messages', { error: (err as Error).message });
    }

    // ------------------------------------------------------------------
    // 2. Read notifications older than 90 days
    // ------------------------------------------------------------------
    try {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 90);

      const deleted = await prisma.notification.deleteMany({
        where: { isRead: true, createdAt: { lt: cutoff } },
      });
      results.notifications = deleted.count;
    } catch (err) {
      logger.error('[Retention] Failed to purge notifications', { error: (err as Error).message });
    }

    // ------------------------------------------------------------------
    // 3. Expired refresh tokens
    // ------------------------------------------------------------------
    try {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);

      const deleted = await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { createdAt: { lt: cutoff } },
          ],
        },
      });
      results.refreshTokens = deleted.count;
    } catch (err) {
      logger.error('[Retention] Failed to purge refresh tokens', { error: (err as Error).message });
    }

    // ------------------------------------------------------------------
    // 4. Expired user invites (unused, past expiry + 30 days buffer)
    // ------------------------------------------------------------------
    try {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);

      const deleted = await prisma.userInvite.deleteMany({
        where: {
          usedAt: null,
          expiresAt: { lt: cutoff },
        },
      });
      results.expiredInvites = deleted.count;
    } catch (err) {
      logger.error('[Retention] Failed to purge expired invites', { error: (err as Error).message });
    }

    // ------------------------------------------------------------------
    // 5. Soft-deleted users older than 2 years (hard delete)
    // ------------------------------------------------------------------
    try {
      const cutoff = new Date(now);
      cutoff.setFullYear(cutoff.getFullYear() - 2);

      const deleted = await prisma.user.deleteMany({
        where: {
          isDeleted: true,
          updatedAt: { lt: cutoff },
        },
      });
      results.deletedUsers = deleted.count;
    } catch (err) {
      logger.error('[Retention] Failed to purge soft-deleted users', { error: (err as Error).message });
    }

    // ------------------------------------------------------------------
    // 6. Completed attendance sessions older than 2 years
    //    (keep records for academic history; drop very old ones)
    // ------------------------------------------------------------------
    try {
      const cutoff = new Date(now);
      cutoff.setFullYear(cutoff.getFullYear() - 2);

      // Must delete child records first (attendance records)
      const oldSessions = await prisma.attendanceSession.findMany({
        where: { status: 'COMPLETED', endedAt: { lt: cutoff } },
        select: { id: true },
      });

      if (oldSessions.length > 0) {
        const ids = oldSessions.map((s) => s.id);

        await prisma.attendanceRecord.deleteMany({
          where: { sessionId: { in: ids } },
        });
        const deleted = await prisma.attendanceSession.deleteMany({
          where: { id: { in: ids } },
        });
        results.attendanceSessions = deleted.count;
      } else {
        results.attendanceSessions = 0;
      }
    } catch (err) {
      logger.error('[Retention] Failed to purge old attendance sessions', { error: (err as Error).message });
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0);
    logger.info('[Retention] Cycle complete', { ...results, totalDeleted: total });
  });

  logger.info('[Retention] Worker scheduled (nightly at 02:00 UTC)');
}
