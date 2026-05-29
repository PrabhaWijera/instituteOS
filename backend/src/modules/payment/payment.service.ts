import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { RecordPaymentInput } from './payment.schema';
import { PaginationParams, paginatedResponse } from '../../utils/pagination';
import { notificationService } from '../notification/notification.service';

class PaymentService {
  async getStudentDues(userId: string) {
    const student = await prisma.student.findFirst({ where: { userId } });
    if (!student) throw new ApiError(404, 'Student not found');

    return prisma.paymentDue.findMany({
      where: { studentId: student.id },
      include: {
        enrollment: { include: { class: { select: { name: true, subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async signalReady(paymentId: string, userId: string) {
    const student = await prisma.student.findFirst({ where: { userId } });
    if (!student) throw new ApiError(404, 'Student not found');

    const payment = await prisma.paymentDue.findFirst({
      where: { id: paymentId, studentId: student.id },
    });
    if (!payment) throw new ApiError(404, 'Payment due not found');
    if (payment.status !== 'UNPAID') throw new ApiError(400, 'Payment is not in UNPAID status');

    return prisma.paymentDue.update({
      where: { id: paymentId },
      data: { status: 'PAYMENT_READY', readyAt: new Date() },
    });
  }

  async getAllDues(instituteId: string, pagination: PaginationParams, filters?: { classId?: string; status?: string }) {
    const where: Record<string, unknown> = { student: { instituteId } };
    if (filters?.status) where.status = filters.status;
    if (filters?.classId) where.enrollment = { classId: filters.classId };

    const [dues, total] = await Promise.all([
      prisma.paymentDue.findMany({
        where,
        include: {
          student: { include: { user: { select: { fullName: true, email: true } } } },
          enrollment: { include: { class: { select: { name: true, subject: true } } } },
          recordedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.paymentDue.count({ where }),
    ]);

    return paginatedResponse(dues, total, pagination);
  }

  async getClassDues(classId: string) {
    return prisma.paymentDue.findMany({
      where: { enrollment: { classId } },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        enrollment: { include: { class: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordPayment(paymentId: string, data: RecordPaymentInput, recordedById: string) {
    const payment = await prisma.paymentDue.findUnique({
      where: { id: paymentId },
      include: { enrollment: true },
    });
    if (!payment) throw new ApiError(404, 'Payment due not found');
    if (payment.status === 'PAID') throw new ApiError(400, 'Payment already recorded');

    const result = await prisma.$transaction(async (tx) => {
      // Mark payment as paid
      const updatedPayment = await tx.paymentDue.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          recordedById,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          amount: data.amount || payment.amount,
        },
      });

      // Update enrollment status back to ACTIVE
      await tx.studentEnrollment.update({
        where: { id: payment.enrollmentId },
        data: { subscriptionStatus: 'ACTIVE' },
      });

      // Create notification for student (respects institute setting, fire-and-forget after tx)
      const student = await tx.student.findUnique({ where: { id: payment.studentId } });
      if (student) {
        notificationService.notifyIfEnabled('notifyPaymentReceipt', {
          userId: student.userId,
          instituteId: student.instituteId,
          title: 'Payment Received',
          message: `Your payment of LKR ${data.amount || payment.amount} has been recorded.`,
          type: 'PAYMENT_RECEIPT',
        });
      }

      return updatedPayment;
    });

    return result;
  }

  async getInstituteReport(instituteId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [totalBilled, totalCollected, outstanding] = await Promise.all([
      prisma.paymentDue.aggregate({
        where: { student: { instituteId }, periodStart: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.paymentDue.aggregate({
        where: { student: { instituteId }, status: 'PAID', paidAt: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.paymentDue.aggregate({
        where: { student: { instituteId }, status: { in: ['UNPAID', 'PAYMENT_READY'] } },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalBilled: totalBilled._sum.amount || 0,
      totalCollected: totalCollected._sum.amount || 0,
      outstanding: outstanding._sum.amount || 0,
      collectionRate: totalBilled._sum.amount
        ? Math.round(((totalCollected._sum.amount || 0) / totalBilled._sum.amount) * 100)
        : 0,
    };
  }

  async getPaymentStatus(studentId: string, classId: string) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId, classId },
    });
    if (!enrollment) return { isBlocked: true, status: 'NOT_ENROLLED' };

    const isBlocked = enrollment.subscriptionStatus === 'PAYMENT_DUE' || enrollment.subscriptionStatus === 'SUSPENDED';
    return { isBlocked, status: enrollment.subscriptionStatus };
  }
}

export const paymentService = new PaymentService();
