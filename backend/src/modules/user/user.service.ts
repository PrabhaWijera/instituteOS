import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/hash';
import { generateInviteToken } from '../../utils/invite';
import { UpdateUserInput, InviteTeacherInput, UsersQuery } from './user.schema';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { notificationService } from '../notification/notification.service';
import { cacheInvalidate, cacheKey } from '../../utils/cache';

class UserService {
  async findAll(query: UsersQuery) {
    const where: Prisma.UserWhereInput = { isDeleted: false };

    if (query.role) where.role = query.role;
    if (query.instituteId) where.instituteId = query.instituteId;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          profileImage: true,
          isActive: true,
          lastLoginAt: true,
          instituteId: true,
          createdAt: true,
          institute: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        profileImage: true,
        isActive: true,
        isDeleted: true,
        lastLoginAt: true,
        instituteId: true,
        createdAt: true,
        updatedAt: true,
        institute: { select: { name: true } },
      },
    });

    if (!user) throw new ApiError(404, 'User not found');
    return user;
  }

  async update(id: string, data: UpdateUserInput) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, 'User not found');

    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, 'User not found');

    return prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async deleteUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, 'User not found');

    if (user.role === 'SUPER_ADMIN') {
      throw new ApiError(403, 'Cannot deactivate the super admin account');
    }

    // Soft deactivate: revoke sessions, mark inactive/deleted, and free up the email
    // by appending a suffix so the same email can be re-registered later.
    const freedEmail = `${user.email}+deleted_${Date.now()}`;
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: { isActive: false, isDeleted: true, email: freedEmail },
      }),
    ]);

    return { message: 'User deleted' };
  }

  async resendInvite(userId: string, sentById: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'User not found');

    const invite = await prisma.userInvite.findFirst({
      where: { email: user.email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!invite) throw new ApiError(404, 'No pending invite found');

    // Regenerate token + extend expiry
    const token = generateInviteToken();
    await prisma.userInvite.update({
      where: { id: invite.id },
      data: { token, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) },
    });

    // Send the appropriate email
    const { notificationService } = await import('../notification/notification.service');
    const institute = user.instituteId
      ? await prisma.institute.findUnique({ where: { id: user.instituteId }, select: { name: true } })
      : null;
    const instituteName = institute?.name || 'Your Institute';

    if (user.role === 'INSTITUTE_ADMIN') {
      notificationService.sendEmail('instituteCreated', {
        to: user.email,
        adminName: user.fullName,
        instituteName,
        inviteLink: token,
      });
    } else if (user.role === 'TEACHER') {
      notificationService.sendEmail('teacherInvited', {
        to: user.email,
        teacherName: user.fullName,
        instituteName,
        inviteLink: token,
      });
    } else if (user.role === 'STUDENT') {
      notificationService.sendEmail('studentRegistered', {
        to: user.email,
        studentName: user.fullName,
        instituteName,
        inviteLink: token,
      });
    } else if (user.role === 'PARENT') {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: userId },
        include: { student: { include: { user: { select: { fullName: true } } } } },
      });
      notificationService.sendEmail('parentInvited', {
        to: user.email,
        parentName: user.fullName,
        childName: link?.student?.user?.fullName || 'your child',
        instituteName,
        inviteLink: token,
      });
    }

    return { message: 'Invite resent successfully' };
  }

  // Faculty (teacher) management for institute admin
  async getFaculty(instituteId: string) {
    return prisma.user.findMany({
      where: {
        instituteId,
        role: 'TEACHER',
        isDeleted: false,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        profileImage: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        teacherClasses: {
          where: { isDeleted: false },
          select: { id: true, name: true, subject: true, grade: true },
        },
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async inviteTeacher(data: InviteTeacherInput, instituteId: string, sentById: string) {
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
          role: 'TEACHER',
          isActive: false,
          instituteId,
        },
      });

      const invite = await tx.userInvite.create({
        data: {
          email: data.email,
          token,
          role: 'TEACHER',
          instituteId,
          sentById,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      return { user, invite };
    });

    // Send invite email (non-blocking)
    const institute = await prisma.institute.findUnique({ where: { id: instituteId }, select: { name: true } });
    notificationService.sendEmail('teacherInvited', {
      to: data.email,
      teacherName: data.fullName,
      instituteName: institute?.name || 'Your Institute',
      inviteLink: token,
    });

    cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));
    cacheInvalidate(cacheKey('dashboard', 'super-admin'));
    return { ...result, inviteToken: token };
  }

  async getFacultyById(id: string, instituteId: string) {
    const teacher = await prisma.user.findFirst({
      where: { id, instituteId, role: 'TEACHER', isDeleted: false },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        profileImage: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        teacherClasses: {
          where: { isDeleted: false },
          select: { id: true, name: true, subject: true, grade: true, scheduleDays: true, startTime: true },
        },
        _count: { select: { sessions: true } },
      },
    });

    if (!teacher) throw new ApiError(404, 'Teacher not found');
    return teacher;
  }

  async updateFaculty(id: string, instituteId: string, data: { fullName?: string; phone?: string }) {
    const teacher = await prisma.user.findFirst({
      where: { id, instituteId, role: 'TEACHER' },
    });
    if (!teacher) throw new ApiError(404, 'Teacher not found');

    return prisma.user.update({ where: { id }, data });
  }

  async toggleFacultyStatus(id: string, instituteId: string) {
    const teacher = await prisma.user.findFirst({
      where: { id, instituteId, role: 'TEACHER', isDeleted: false },
    });
    if (!teacher) throw new ApiError(404, 'Teacher not found');

    // Only toggle active/inactive — does NOT soft-delete
    const result = await prisma.user.update({
      where: { id },
      data: { isActive: !teacher.isActive },
    });
    cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));
    cacheInvalidate(cacheKey('dashboard', 'super-admin'));
    return result;
  }

  async deleteFaculty(id: string, instituteId: string) {
    const teacher = await prisma.user.findFirst({
      where: { id, instituteId, role: 'TEACHER', isDeleted: false },
    });
    if (!teacher) throw new ApiError(404, 'Teacher not found');

    // Free up the email so it can be re-invited with the same address
    const freedEmail = `${teacher.email}+deleted_${Date.now()}`;

    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: { isActive: false, isDeleted: true, email: freedEmail },
      }),
    ]);

    cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));
    cacheInvalidate(cacheKey('dashboard', 'super-admin'));
    return { message: 'Teacher deleted successfully' };
  }

  async getInvites(instituteId: string) {
    return prisma.userInvite.findMany({
      where: { instituteId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteInvite(inviteId: string, instituteId: string) {
    const invite = await prisma.userInvite.findFirst({
      where: { id: inviteId, instituteId },
    });
    if (!invite) throw new ApiError(404, 'Invite not found');

    await prisma.userInvite.delete({ where: { id: inviteId } });
    return { message: 'Invite cancelled' };
  }

  async getUserSessions(userId: string) {
    const sessions = await prisma.refreshToken.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => ({
      ...s,
      isExpired: s.expiresAt < new Date(),
    }));
  }

  async revokeUserSessions(userId: string) {
    const result = await prisma.refreshToken.deleteMany({
      where: { userId },
    });
    return { revokedCount: result.count };
  }

  async revokeSession(sessionId: string) {
    const session = await prisma.refreshToken.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new ApiError(404, 'Session not found');

    await prisma.refreshToken.delete({ where: { id: sessionId } });
    return { revoked: true };
  }
}

export const userService = new UserService();
