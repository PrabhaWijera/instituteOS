import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { CreateClassInput, UpdateClassInput } from './class.schema';

class ClassService {
  async create(data: CreateClassInput, instituteId: string) {
    // Verify teacher belongs to same institute
    const teacher = await prisma.user.findFirst({
      where: { id: data.teacherId, instituteId, role: 'TEACHER', isDeleted: false },
    });
    if (!teacher) throw new ApiError(404, 'Teacher not found at this institute');

    const tuitionClass = await prisma.tuitionClass.create({
      data: {
        ...data,
        instituteId,
      },
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
      },
    });

    return tuitionClass;
  }

  async findAll(instituteId: string, teacherId?: string) {
    const where: any = { instituteId, isDeleted: false };
    if (teacherId) where.teacherId = teacherId;

    return prisma.tuitionClass.findMany({
      where,
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        _count: {
          select: {
            enrollments: { where: { subscriptionStatus: { not: 'CANCELLED' } } },
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, instituteId: string, role?: string, callerId?: string) {
    const includeRoster =
      role === 'INSTITUTE_ADMIN' ||
      (role === 'TEACHER' && callerId !== undefined);

    const tuitionClass = await prisma.tuitionClass.findFirst({
      where: { id, instituteId, isDeleted: false },
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        enrollments: includeRoster
          ? {
              where: { subscriptionStatus: { not: 'CANCELLED' } },
              include: {
                student: {
                  include: { user: { select: { id: true, fullName: true, email: true, profileImage: true } } },
                },
              },
            }
          : false,
        _count: {
          select: {
            enrollments: { where: { subscriptionStatus: { not: 'CANCELLED' } } },
            sessions: true,
            materials: true,
          },
        },
      },
    });

    if (!tuitionClass) throw new ApiError(404, 'Class not found');

    // Teacher can only see the roster for their own class
    if (role === 'TEACHER' && callerId && tuitionClass.teacherId !== callerId) {
      const { ...rest } = tuitionClass as any;
      delete rest.enrollments;
      return rest;
    }

    return tuitionClass;
  }

  async update(id: string, instituteId: string, data: UpdateClassInput) {
    const existing = await prisma.tuitionClass.findFirst({
      where: { id, instituteId, isDeleted: false },
    });
    if (!existing) throw new ApiError(404, 'Class not found');

    if (data.teacherId) {
      const teacher = await prisma.user.findFirst({
        where: { id: data.teacherId, instituteId, role: 'TEACHER', isDeleted: false },
      });
      if (!teacher) throw new ApiError(404, 'Teacher not found at this institute');
    }

    return prisma.tuitionClass.update({ where: { id }, data });
  }

  async updateStatus(id: string, instituteId: string, isActive: boolean) {
    const existing = await prisma.tuitionClass.findFirst({
      where: { id, instituteId },
    });
    if (!existing) throw new ApiError(404, 'Class not found');

    return prisma.tuitionClass.update({ where: { id }, data: { isActive } });
  }

  async softDelete(id: string, instituteId: string) {
    const existing = await prisma.tuitionClass.findFirst({
      where: { id, instituteId },
    });
    if (!existing) throw new ApiError(404, 'Class not found');

    return prisma.tuitionClass.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  }

  async getTeacherClasses(teacherId: string) {
    return prisma.tuitionClass.findMany({
      where: { teacherId, isDeleted: false },
      include: {
        _count: {
          select: {
            enrollments: { where: { subscriptionStatus: { not: 'CANCELLED' } } },
            sessions: true,
            materials: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForStudent(studentId: string, instituteId: string) {
    return prisma.tuitionClass.findMany({
      where: {
        instituteId,
        isDeleted: false,
        enrollments: {
          some: { studentId, subscriptionStatus: { not: 'CANCELLED' } },
        },
      },
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        _count: {
          select: {
            enrollments: { where: { subscriptionStatus: { not: 'CANCELLED' } } },
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForParent(parentUserId: string, instituteId: string) {
    // Parents are linked to students via the student's parentEmail matching the parent's user email
    const parent = await prisma.user.findUnique({ where: { id: parentUserId }, select: { email: true } });
    if (!parent) return [];

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        subscriptionStatus: { not: 'CANCELLED' },
        student: { parentEmail: parent.email },
        class: { instituteId, isDeleted: false },
      },
      include: {
        class: {
          include: {
            teacher: { select: { id: true, fullName: true, email: true } },
            _count: {
              select: {
                enrollments: { where: { subscriptionStatus: { not: 'CANCELLED' } } },
                sessions: true,
              },
            },
          },
        },
      },
    });

    const seen = new Set<string>();
    return enrollments
      .map((e) => e.class)
      .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  }
}

export const classService = new ClassService();
