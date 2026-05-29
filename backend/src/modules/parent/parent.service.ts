import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

class ParentService {
  async getChildren(userId: string) {
    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: userId },
      include: {
        student: {
          include: {
            user: { select: { id: true, fullName: true, email: true, profileImage: true } },
            enrollments: {
              where: { subscriptionStatus: { not: 'CANCELLED' } },
              include: { class: { select: { id: true, name: true, subject: true, grade: true } } },
            },
          },
        },
      },
    });

    return links.map((l) => l.student);
  }

  async getChildDetail(userId: string, studentId: string) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: userId, studentId },
    });
    if (!link) throw new ApiError(403, 'You are not linked to this student');

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, profileImage: true } },
        enrollments: {
          where: { subscriptionStatus: { not: 'CANCELLED' } },
          include: {
            class: { select: { name: true, subject: true, grade: true, teacher: { select: { fullName: true } } } },
            paymentDues: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
        attendanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { session: { include: { class: { select: { name: true } } } } },
        },
      },
    });

    if (!student) throw new ApiError(404, 'Student not found');

    // Calculate attendance stats
    const totalSessions = await prisma.attendanceSession.count({
      where: { classId: { in: student.enrollments.map((e) => e.classId) } },
    });
    const attendedCount = student.attendanceRecords.length;

    return {
      student,
      attendanceRate: totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0,
      totalSessions,
      attendedCount,
    };
  }

  async getChildPayments(userId: string, studentId: string) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: userId, studentId },
    });
    if (!link) throw new ApiError(403, 'You are not linked to this student');

    return prisma.paymentDue.findMany({
      where: { studentId },
      include: {
        enrollment: { include: { class: { select: { name: true, subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChildAttendance(userId: string, studentId: string) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: userId, studentId },
    });
    if (!link) throw new ApiError(403, 'You are not linked to this student');

    return prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        session: { include: { class: { select: { name: true, subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getChildMaterials(userId: string, studentId: string) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: userId, studentId },
    });
    if (!link) throw new ApiError(403, 'You are not linked to this student');

    const enrollments = await prisma.studentEnrollment.findMany({
      where: { studentId, subscriptionStatus: { not: 'CANCELLED' } },
    });

    const classIds = enrollments.map((e) => e.classId);

    return prisma.classMaterial.findMany({
      where: { classId: { in: classIds }, isVisible: true },
      include: { class: { select: { name: true } }, uploadedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const parentService = new ParentService();
