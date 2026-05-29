import cron from 'node-cron';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { addDuration } from '../../utils/duration';
import { notificationService } from '../notification/notification.service';

export function startBillingWorker() {
  const schedule = env.BILLING_CRON;
  cron.schedule(schedule, async () => {
    console.log('[Billing Worker] Starting cycle...');

    const now = new Date();

    try {
      // Find all ACTIVE enrollments where nextBillingDate has passed
      const dueEnrollments = await prisma.studentEnrollment.findMany({
        where: {
          subscriptionStatus: 'ACTIVE',
          nextBillingDate: { lte: now },
        },
        include: {
          class: true,
          student: { include: { user: true } },
        },
      });

      for (const enrollment of dueEnrollments) {
        const periodStart = enrollment.nextBillingDate!;
        const periodEnd = addDuration(periodStart, env.BILLING_CYCLE);

        try {
          await prisma.$transaction(async (tx) => {
            // 1. Insert payment due
            await tx.paymentDue.create({
              data: {
                enrollmentId: enrollment.id,
                studentId: enrollment.studentId,
                amount: enrollment.class.feeAmount,
                periodStart,
                periodEnd,
                status: 'UNPAID',
              },
            });

            // 2. Update enrollment status
            await tx.studentEnrollment.update({
              where: { id: enrollment.id },
              data: {
                subscriptionStatus: 'PAYMENT_DUE',
                lastBillingDate: periodStart,
                nextBillingDate: periodEnd,
              },
            });

            // 3. In-app notification for student (respects institute setting)
            notificationService.notifyIfEnabled('notifyFeeDue', {
              userId: enrollment.student.userId,
              instituteId: enrollment.student.instituteId,
              title: 'Fee Due',
              message: `Your fee of LKR ${enrollment.class.feeAmount} for ${enrollment.class.name} is due.`,
              type: 'FEE_DUE',
            });
          });
        } catch (err) {
          console.error(`[Billing Worker] Failed for enrollment ${enrollment.id}:`, err);
        }
      }

      // Handle grace period → SUSPENDED
      const allSettings = await prisma.instituteSettings.findMany();
      for (const settings of allSettings) {
        const graceDays = settings.gracePeriodDays + settings.autoSuspendAfterDays;
        const suspendDate = new Date();
        suspendDate.setDate(suspendDate.getDate() - graceDays);

        await prisma.studentEnrollment.updateMany({
          where: {
            subscriptionStatus: 'PAYMENT_DUE',
            class: { instituteId: settings.instituteId },
            updatedAt: { lte: suspendDate },
          },
          data: { subscriptionStatus: 'SUSPENDED' },
        });
      }

      console.log(`[Billing Worker] Cycle complete. Processed ${dueEnrollments.length} enrollments.`);
    } catch (err) {
      console.error('[Billing Worker] Fatal error:', err);
    }
  });
}
