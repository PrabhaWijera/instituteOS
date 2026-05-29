import prisma from '../../config/prisma';
import redis from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import logger from '../../utils/logger';

/**
 * GDPR / Privacy compliance service.
 *
 * Implements the right-to-access (Art. 15) and right-to-erasure (Art. 17)
 * obligations of the GDPR and equivalent CCPA rights.
 */
class GdprService {
  // -------------------------------------------------------------------------
  // Right to Access — export a machine-readable copy of all personal data
  // -------------------------------------------------------------------------
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        profileImage: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        institute: { select: { id: true, name: true, city: true } },
      },
    });

    if (!user) throw new ApiError(404, 'User not found');

    // Collect all data linked to this user in parallel
    const [student, notifications, refreshTokenCount, invites, aiHistory] = await Promise.all([
      prisma.student.findFirst({
        where: { userId },
        select: {
          id: true,
          dob: true,
          address: true,
          verificationStatus: true,
          createdAt: true,
          enrollments: {
            select: {
              enrolledAt: true,
              subscriptionStatus: true,
              class: { select: { name: true, subject: true, grade: true } },
            },
          },
        },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { title: true, message: true, type: true, isRead: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.refreshToken.count({ where: { userId } }),
      prisma.userInvite.findMany({
        where: { email: user.email },
        select: { email: true, role: true, createdAt: true, usedAt: true },
      }),
      prisma.aiChatMessage.findMany({
        where: { userId },
        select: { role: true, content: true, subject: true, grade: true, language: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      }),
    ]);

    // Attendance records (via student)
    const attendanceRecords = student
      ? await prisma.attendanceRecord.findMany({
          where: { studentId: student.id },
          select: {
            checkInTime: true,
            isManual: true,
            distanceMeters: true,
            createdAt: true,
            session: { select: { startedAt: true, class: { select: { name: true } } } },
          },
          take: 500,
        })
      : [];

    const paymentHistory = student
      ? await prisma.paymentDue.findMany({
          where: { studentId: student.id },
          select: {
            amount: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            paidAt: true,
            paymentMethod: true,
          },
          take: 200,
        })
      : [];

    logger.info('[GDPR] Data export generated', { userId, timestamp: new Date().toISOString() });

    return {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      subject: 'data-subject-access-request',
      profile: user,
      studentProfile: student,
      enrollments: student?.enrollments ?? [],
      attendance: attendanceRecords,
      payments: paymentHistory,
      aiChatHistory: aiHistory,
      notifications,
      activeSessions: refreshTokenCount,
      invites,
    };
  }

  // -------------------------------------------------------------------------
  // Right to Erasure — anonymise / hard-delete personal data
  //
  // Strategy: anonymise identifiable fields in-place rather than hard-deleting
  // rows, so relational integrity and audit trails are preserved.
  // Hard-delete supplementary PII data (chat history, notifications).
  // -------------------------------------------------------------------------
  async deleteUserData(userId: string, requestedBy: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'User not found');

    // Only the user themselves or a Super Admin can trigger erasure
    if (requestedBy !== userId) {
      const requester = await prisma.user.findUnique({ where: { id: requestedBy } });
      if (!requester || requester.role !== 'SUPER_ADMIN') {
        throw new ApiError(403, 'Only the account owner or a Super Admin can request data deletion');
      }
    }

    const anonymisedEmail = `deleted_${userId}@nexclass.deleted`;
    const timestamp = new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      // 1. Anonymise user profile (preserve row for FK integrity)
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymisedEmail,
          fullName: '[Deleted User]',
          phone: null,
          profileImage: null,
          isActive: false,
          isDeleted: true,
        },
      });

      // 2. Anonymise student profile if present
      const student = await tx.student.findFirst({ where: { userId } });
      if (student) {
        await tx.student.update({
          where: { id: student.id },
          data: {
            address: null,
            dob: null,
            parentName: null,
            parentEmail: null,
            parentPhone: null,
          },
        });

        // 3. Purge attendance location data (GPS coords are PII)
        await tx.attendanceRecord.updateMany({
          where: { studentId: student.id },
          data: { latitude: null, longitude: null, distanceMeters: null },
        });
      }

      // 4. Hard-delete AI chat history (most personal data)
      await tx.aiChatMessage.deleteMany({ where: { userId } });

      // 5. Hard-delete notifications
      await tx.notification.deleteMany({ where: { userId } });

      // 6. Revoke all sessions
      await tx.refreshToken.deleteMany({ where: { userId } });
    });

    // Invalidate any Redis cached data for this user
    try {
      await redis.del(`ratelimit:user:ai:${userId}`);
      await redis.del(`ratelimit:user:general:${userId}`);
    } catch { /* non-critical */ }

    logger.info('[GDPR] User data erased', {
      userId,
      requestedBy,
      anonymisedEmail,
      timestamp,
    });

    return {
      message:
        'Your personal data has been anonymised and sensitive records deleted. ' +
        'Some anonymised records may be retained for legal/accounting purposes.',
    };
  }
}

export const gdprService = new GdprService();
