import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/hash';
import { generateInviteToken } from '../../utils/invite';
import { CreateInstituteInput, UpdateInstituteInput, UpdateInstituteSettingsInput } from './institute.schema';
import { PaginationParams, paginatedResponse } from '../../utils/pagination';
import crypto from 'crypto';
import { notificationService } from '../notification/notification.service';
import { cacheInvalidate, cacheKey } from '../../utils/cache';

const invalidateSuperAdminDashboard = () => cacheInvalidate(cacheKey('dashboard', 'super-admin'));
const invalidateAdminDashboard = (instituteId: string) => cacheInvalidate(cacheKey('dashboard', 'admin', instituteId));

class InstituteService {
  async create(data: CreateInstituteInput, createdByUserId: string) {
    // Only block if an active (non-deleted) institute already has this code
    const existingCode = await prisma.institute.findFirst({
      where: { code: data.code, isDeleted: false },
    });
    if (existingCode) {
      throw new ApiError(409, 'Institute code already in use by an active institute');
    }

    // Only block if an active (non-deleted) user already has this email
    const existingEmail = await prisma.user.findFirst({
      where: { email: data.adminEmail, isDeleted: false },
    });
    if (existingEmail) {
      throw new ApiError(409, 'Admin email already in use by an active account');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create institute
      const institute = await tx.institute.create({
        data: {
          name: data.name,
          code: data.code,
          address: data.address,
          city: data.city,
          phone: data.phone,
          subscriptionPlan: data.subscriptionPlan,
          lat: data.lat,
          lng: data.lng,
        },
      });

      // Create default settings
      await tx.instituteSettings.create({
        data: { instituteId: institute.id },
      });

      // Create admin user (inactive until invite accepted)
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const adminUser = await tx.user.create({
        data: {
          email: data.adminEmail,
          passwordHash: await hashPassword(tempPassword),
          fullName: data.adminName,
          phone: data.adminPhone,
          role: 'INSTITUTE_ADMIN',
          isActive: false,
          instituteId: institute.id,
        },
      });

      // Create invite
      const token = generateInviteToken();
      await tx.userInvite.create({
        data: {
          email: data.adminEmail,
          token,
          role: 'INSTITUTE_ADMIN',
          instituteId: institute.id,
          sentById: createdByUserId,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      return { institute, adminUser, inviteToken: token };
    });

    // Send invite email (non-blocking)
    notificationService.sendEmail('instituteCreated', {
      to: data.adminEmail,
      adminName: data.adminName,
      instituteName: data.name,
      inviteLink: result.inviteToken,
    });

    invalidateSuperAdminDashboard();
    return result;
  }

  async findAll(pagination: PaginationParams, search?: string) {
    const baseWhere = { isDeleted: false } as const;
    const where = search
      ? {
          ...baseWhere,
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : baseWhere;

    const [institutes, total] = await Promise.all([
      prisma.institute.findMany({
        where,
        include: {
          _count: {
            select: {
              users: { where: { role: 'TEACHER', isDeleted: false } },
              students: { where: { isDeleted: false } },
              classes: { where: { isDeleted: false } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.institute.count({ where }),
    ]);

    const mapped = institutes.map((inst) => ({
      ...inst,
      teacherCount: inst._count.users,
      studentCount: inst._count.students,
      classCount: inst._count.classes,
      _count: undefined,
    }));

    return paginatedResponse(mapped, total, pagination);
  }

  async findById(id: string) {
    const institute = await prisma.institute.findFirst({
      where: { id, isDeleted: false },
      include: {
        settings: true,
        users: {
          where: { role: 'INSTITUTE_ADMIN' },
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            users: { where: { role: 'TEACHER', isDeleted: false } },
            students: { where: { isDeleted: false } },
            classes: { where: { isDeleted: false } },
          },
        },
      },
    });

    if (!institute) {
      throw new ApiError(404, 'Institute not found');
    }

    return {
      ...institute,
      admin: institute.users[0] || null,
      teacherCount: institute._count.users,
      studentCount: institute._count.students,
      classCount: institute._count.classes,
      users: undefined,
      _count: undefined,
    };
  }

  async update(id: string, data: UpdateInstituteInput) {
    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) throw new ApiError(404, 'Institute not found');

    return prisma.institute.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) throw new ApiError(404, 'Institute not found');

    const result = await prisma.institute.update({ where: { id }, data: { isActive } });
    // Immediately invalidate the per-request institute status cache so existing sessions
    // are blocked on their next API call (within 30 seconds at most).
    cacheInvalidate(`inst_status:${id}`);
    invalidateSuperAdminDashboard();
    invalidateAdminDashboard(id);
    return result;
  }

  async delete(id: string) {
    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) throw new ApiError(404, 'Institute not found');

    const ts = Date.now();

    // Free up the institute code so a new institute with the same code can be created
    const freedCode = `${institute.code}_deleted_${ts}`;

    // Soft delete — marks institute and all its data as deleted so they
    // disappear from every list, but no FK rows are physically removed.
    // Also free up user emails so those addresses can be re-used.
    await prisma.$transaction(async (tx) => {
      // Rename emails for all institute users so they can be re-registered
      const instituteUsers = await tx.user.findMany({
        where: { instituteId: id, isDeleted: false },
        select: { id: true, email: true },
      });
      for (const u of instituteUsers) {
        await tx.user.update({
          where: { id: u.id },
          data: { email: `${u.email}+deleted_${ts}`, isActive: false, isDeleted: true },
        });
      }

      await tx.institute.update({
        where: { id },
        data: { isActive: false, isDeleted: true, deletedAt: new Date(), code: freedCode },
      });
      await tx.student.updateMany({ where: { instituteId: id }, data: { isDeleted: true } });
      await tx.tuitionClass.updateMany({ where: { instituteId: id }, data: { isDeleted: true } });
      await tx.userInvite.deleteMany({ where: { instituteId: id } });
    });

    cacheInvalidate(`inst_status:${id}`);
    invalidateSuperAdminDashboard();
    invalidateAdminDashboard(id);
    return { message: 'Institute deleted successfully' };
  }

  async getOwnInstitute(instituteId: string) {
    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      include: { settings: true },
    });
    if (!institute) throw new ApiError(404, 'Institute not found');
    return institute;
  }

  async updateOwnInstitute(instituteId: string, data: UpdateInstituteInput) {
    return prisma.institute.update({
      where: { id: instituteId },
      data,
    });
  }

  async getSettings(instituteId: string) {
    const settings = await prisma.instituteSettings.findUnique({
      where: { instituteId },
    });
    // Auto-create default settings if none exist yet
    if (!settings) {
      return prisma.instituteSettings.create({
        data: { instituteId },
      });
    }
    return settings;
  }

  async updateSettings(instituteId: string, data: UpdateInstituteSettingsInput) {
    return prisma.instituteSettings.upsert({
      where: { instituteId },
      update: data,
      create: { instituteId, ...data },
    });
  }
}

export const instituteService = new InstituteService();
