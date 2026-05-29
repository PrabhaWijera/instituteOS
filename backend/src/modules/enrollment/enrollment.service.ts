import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { CreateEnrollmentInput } from './enrollment.schema';
import { addDuration } from '../../utils/duration';
import { env } from '../../config/env';
import { notificationService } from '../notification/notification.service';

class EnrollmentService {
  async create(data: CreateEnrollmentInput, instituteId: string) {
    // Verify student belongs to institute
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, instituteId, isDeleted: false },
    });
    if (!student) throw new ApiError(404, 'Student not found at this institute');

    // Verify class belongs to institute
    const tuitionClass = await prisma.tuitionClass.findFirst({
      where: { id: data.classId, instituteId, isDeleted: false },
    });
    if (!tuitionClass) throw new ApiError(404, 'Class not found at this institute');

    // Check if already enrolled
    const existing = await prisma.studentEnrollment.findUnique({
      where: { studentId_classId: { studentId: data.studentId, classId: data.classId } },
    });
    if (existing && existing.subscriptionStatus !== 'CANCELLED') {
      throw new ApiError(409, 'Student is already enrolled in this class');
    }

    // Check capacity
    if (tuitionClass.maxCapacity) {
      const count = await prisma.studentEnrollment.count({
        where: { classId: data.classId, subscriptionStatus: { not: 'CANCELLED' } },
      });
      if (count >= tuitionClass.maxCapacity) {
        throw new ApiError(400, 'Class has reached maximum capacity');
      }
    }

    const nextBilling = addDuration(new Date(), env.BILLING_CYCLE);

    if (existing) {
      // Re-enroll cancelled student
      return prisma.studentEnrollment.update({
        where: { id: existing.id },
        data: { subscriptionStatus: 'ACTIVE', nextBillingDate: nextBilling },
      });
    }

    const enrollment = await prisma.studentEnrollment.create({
      data: {
        studentId: data.studentId,
        classId: data.classId,
        subscriptionStatus: 'ACTIVE',
        nextBillingDate: nextBilling,
      },
      include: {
        student: { include: { user: { select: { fullName: true, email: true } } } },
        class: { select: { id: true, name: true, subject: true, feeAmount: true, teacherId: true } },
      },
    });

    // Notify student of enrollment
    notificationService.notifyIfEnabled('notifyEnrollment', {
      userId: enrollment.student.userId,
      instituteId,
      title: 'Enrolled in Class',
      message: `You have been enrolled in ${enrollment.class.name} (${enrollment.class.subject}).`,
      type: 'ENROLLMENT',
    });

    // Notify the class teacher
    notificationService.notifyIfEnabled(null, {
      userId: enrollment.class.teacherId,
      instituteId,
      title: 'New Student Enrolled',
      message: `${enrollment.student.user.fullName} has been enrolled in your class ${enrollment.class.name}.`,
      type: 'ENROLLMENT',
    });

    return enrollment;
  }

  async findAll(instituteId: string, filters?: { classId?: string; status?: string }) {
    const where: any = {
      class: { instituteId },
    };
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.status) where.subscriptionStatus = filters.status;

    return prisma.studentEnrollment.findMany({
      where,
      include: {
        student: { include: { user: { select: { fullName: true, email: true, profileImage: true } } } },
        class: { select: { name: true, subject: true, grade: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async remove(id: string, instituteId: string) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { id, class: { instituteId } },
    });
    if (!enrollment) throw new ApiError(404, 'Enrollment not found');

    return prisma.studentEnrollment.update({
      where: { id },
      data: { subscriptionStatus: 'CANCELLED' },
    });
  }

  async getByStudent(studentId: string) {
    return prisma.studentEnrollment.findMany({
      where: { studentId, subscriptionStatus: { not: 'CANCELLED' } },
      include: {
        class: {
          select: { id: true, name: true, subject: true, grade: true, feeAmount: true, scheduleDays: true, startTime: true, durationMinutes: true, teacher: { select: { fullName: true } } },
        },
      },
    });
  }
}

export const enrollmentService = new EnrollmentService();
