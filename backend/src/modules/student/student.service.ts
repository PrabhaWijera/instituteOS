import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/hash';
import { generateInviteToken } from '../../utils/invite';
import { RegisterStudentInput, UpdateStudentInput, StudentOnboardingInput } from './student.schema';
import { PaginationParams, paginatedResponse } from '../../utils/pagination';
import crypto from 'crypto';
import { notificationService } from '../notification/notification.service';
import { cacheInvalidate, cacheKey } from '../../utils/cache';

class StudentService {
  async register(data: RegisterStudentInput, instituteId: string, sentById: string) {
    // Only block if an active (non-deleted) account exists with this email
    const existing = await prisma.user.findFirst({ where: { email: data.email, isDeleted: false } });
    if (existing) throw new ApiError(409, 'Email already in use by an active account');

    const tempPassword = crypto.randomBytes(16).toString('hex');
    const token = generateInviteToken();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: await hashPassword(tempPassword),
          fullName: data.fullName,
          phone: data.phone,
          role: 'STUDENT',
          isActive: false,
          instituteId,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          instituteId,
          grade: data.grade,
          gender: data.gender,
          dob: data.dob ? new Date(data.dob) : undefined,
          address: data.address,
          parentName: data.parentName,
          parentEmail: data.parentEmail || undefined,
          parentPhone: data.parentPhone,
          verificationStatus: 'PENDING_PROFILE',
        },
      });

      const invite = await tx.userInvite.create({
        data: {
          email: data.email,
          token,
          role: 'STUDENT',
          instituteId,
          classId: data.classId,
          sentById,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      // If classId provided, enroll immediately
      if (data.classId) {
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);
        await tx.studentEnrollment.create({
          data: {
            studentId: student.id,
            classId: data.classId,
            subscriptionStatus: 'ACTIVE',
            nextBillingDate: nextBilling,
          },
        });
      }

      return { user, student, invite };
    });

    // Send invite email (non-blocking)
    const institute = await prisma.institute.findUnique({ where: { id: instituteId }, select: { name: true } });
    notificationService.sendEmail('studentRegistered', {
      to: data.email,
      studentName: data.fullName,
      instituteName: institute?.name || 'Your Institute',
      inviteLink: token,
    });

    // Invalidate admin dashboard so new student count reflects immediately
    cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));
    cacheInvalidate(cacheKey('dashboard', 'super-admin'));
    return { ...result, inviteToken: token };
  }

  async findAll(instituteId: string, pagination: PaginationParams, filters?: { verificationStatus?: string; grade?: string; search?: string }) {
    const where: Record<string, unknown> = { instituteId, isDeleted: false };
    if (filters?.verificationStatus) where.verificationStatus = filters.verificationStatus;
    if (filters?.grade) where.grade = filters.grade;
    if (filters?.search) {
      where.user = { fullName: { contains: filters.search, mode: 'insensitive' } };
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, profileImage: true, isActive: true, createdAt: true },
          },
          enrollments: {
            where: { subscriptionStatus: { not: 'CANCELLED' } },
            select: { id: true, subscriptionStatus: true, class: { select: { name: true } } },
          },
          _count: { select: { enrollments: { where: { subscriptionStatus: { not: 'CANCELLED' } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.student.count({ where }),
    ]);

    return paginatedResponse(students, total, pagination);
  }

  async findById(id: string, instituteId: string) {
    const student = await prisma.student.findFirst({
      where: { id, instituteId, isDeleted: false },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, profileImage: true, isActive: true, lastLoginAt: true, createdAt: true },
        },
        enrollments: {
          include: {
            class: { select: { id: true, name: true, subject: true, feeAmount: true } },
            paymentDues: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
        attendanceRecords: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!student) throw new ApiError(404, 'Student not found');
    return student;
  }

  async update(id: string, instituteId: string, data: UpdateStudentInput) {
    const student = await prisma.student.findFirst({ where: { id, instituteId } });
    if (!student) throw new ApiError(404, 'Student not found');
    if (student.verificationStatus === 'VERIFIED') {
      throw new ApiError(400, 'Cannot edit a verified student profile');
    }

    return prisma.student.update({
      where: { id },
      data: { ...data, dob: data.dob ? new Date(data.dob) : undefined },
    });
  }

  async verify(id: string, instituteId: string) {
    const student = await prisma.student.findFirst({ where: { id, instituteId } });
    if (!student) throw new ApiError(404, 'Student not found');
    if (student.verificationStatus !== 'PENDING_VERIFICATION') {
      throw new ApiError(400, 'Student must be in PENDING_VERIFICATION status to verify');
    }

    const result = await prisma.student.update({ where: { id }, data: { verificationStatus: 'VERIFIED' } });
    cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));
    return result;
  }

  // Toggle active/inactive — does NOT soft-delete, student stays visible
  async toggleActive(id: string, instituteId: string) {
    const student = await prisma.student.findFirst({
      where: { id, instituteId, isDeleted: false },
      include: { user: { select: { id: true, isActive: true } } },
    });
    if (!student) throw new ApiError(404, 'Student not found');
    if (!student.user) throw new ApiError(404, 'Student user account not found');

    const result = await prisma.user.update({
      where: { id: student.user.id },
      data: { isActive: !student.user.isActive },
    });
    cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));
    return { isActive: result.isActive };
  }

  // Soft-delete — removes student from all lists, frees email for re-registration
  async deleteStudent(id: string, instituteId: string) {
    const student = await prisma.student.findFirst({
      where: { id, instituteId, isDeleted: false },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!student) throw new ApiError(404, 'Student not found');

    const ts = Date.now();
    const freedEmail = student.user ? `${student.user.email}+deleted_${ts}` : null;

    await prisma.$transaction([
      ...(student.user && freedEmail ? [
        prisma.user.update({
          where: { id: student.user.id },
          data: { email: freedEmail, isActive: false, isDeleted: true },
        }),
      ] : []),
      prisma.student.update({
        where: { id },
        data: { isDeleted: true },
      }),
    ]);

    cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));
    return { message: 'Student deleted successfully' };
  }

  // Student self-service
  async getOwnProfile(userId: string) {
    const student = await prisma.student.findFirst({
      where: { userId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, profileImage: true } },
        enrollments: {
          where: { subscriptionStatus: { not: 'CANCELLED' } },
          include: { class: true },
        },
      },
    });
    if (!student) throw new ApiError(404, 'Student profile not found');
    return student;
  }

  async onboarding(userId: string, data: StudentOnboardingInput) {
    const student = await prisma.student.findFirst({ where: { userId } });
    if (!student) throw new ApiError(404, 'Student not found');
    if (student.verificationStatus !== 'PENDING_PROFILE') {
      throw new ApiError(400, 'Profile can only be edited during onboarding');
    }

    return prisma.student.update({
      where: { id: student.id },
      data: { ...data, dob: data.dob ? new Date(data.dob) : undefined },
    });
  }

  async submitProfile(userId: string) {
    const student = await prisma.student.findFirst({ where: { userId } });
    if (!student) throw new ApiError(404, 'Student not found');
    if (student.verificationStatus !== 'PENDING_PROFILE') {
      throw new ApiError(400, 'Profile already submitted');
    }

    return prisma.student.update({
      where: { id: student.id },
      data: { verificationStatus: 'PENDING_VERIFICATION' },
    });
  }

  async getAcademic(userId: string) {
    const student = await prisma.student.findFirst({
      where: { userId },
      include: {
        enrollments: {
          where: { subscriptionStatus: { not: 'CANCELLED' } },
          include: {
            class: { select: { id: true, name: true, subject: true, grade: true, teacher: { select: { fullName: true } } } },
            paymentDues: { where: { status: { not: 'PAID' } } },
          },
        },
        attendanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { session: { select: { classId: true } } },
        },
      },
    });
    if (!student) throw new ApiError(404, 'Student not found');
    return student;
  }
}

export const studentService = new StudentService();
