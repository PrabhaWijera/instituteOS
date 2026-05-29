import prisma from '../../config/prisma';
import { cacheGet, cacheKey, cacheInvalidate } from '../../utils/cache';

export const DASHBOARD_KEYS = {
  superAdmin: () => cacheKey('dashboard', 'super-admin'),
  admin: (instituteId: string) => cacheKey('dashboard', 'admin', instituteId),
  teacher: (teacherId: string) => cacheKey('dashboard', 'teacher', teacherId),
};

class DashboardService {
  async getSuperAdminDashboard() {
    return cacheGet(DASHBOARD_KEYS.superAdmin(), async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalInstitutes,
        totalStudents,
        activeTeachers,
        inactiveInstitutes,
        recentInstitutes,
        pendingInvites,
      ] = await Promise.all([
        // Only count non-deleted institutes
        prisma.institute.count({ where: { isDeleted: false } }),
        prisma.user.count({ where: { role: 'STUDENT', isDeleted: false } }),
        prisma.user.count({ where: { role: 'TEACHER', isActive: true, isDeleted: false } }),
        // Inactive = not deleted but explicitly deactivated
        prisma.institute.count({ where: { isActive: false, isDeleted: false } }),
        prisma.institute.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, name: true, code: true, city: true, isActive: true, createdAt: true,
            users: {
              where: { role: 'INSTITUTE_ADMIN' },
              take: 1,
              select: { fullName: true },
            },
            _count: { select: { users: { where: { role: 'STUDENT', isDeleted: false } } } },
          },
        }),
        prisma.userInvite.findMany({
          where: { usedAt: null, expiresAt: { gte: new Date() } },
          select: { email: true, expiresAt: true },
        }),
      ]);

      // Build alerts
      const alerts: { type: string; message: string }[] = [];

      const newInstitutes = recentInstitutes.filter(i => new Date(i.createdAt) >= sevenDaysAgo);
      newInstitutes.forEach(i => {
        const daysAgo = Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 86400000);
        alerts.push({ type: 'new', message: `New: ${i.name} registered ${daysAgo === 0 ? 'today' : `${daysAgo}d ago`}` });
      });

      pendingInvites.forEach(inv => {
        const hours = Math.max(0, Math.floor((new Date(inv.expiresAt).getTime() - Date.now()) / 3600000));
        alerts.push({ type: 'pending', message: `Pending invite: ${inv.email} — expires in ${hours}h` });
      });

      const inactiveList = await prisma.institute.findMany({
        where: { isActive: false, isDeleted: false },
        select: { name: true, createdAt: true },
        take: 5,
      });
      inactiveList.forEach(i => {
        const daysAgo = Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 86400000);
        alerts.push({ type: 'inactive', message: `Inactive: ${i.name} — created ${daysAgo}d ago` });
      });

      return {
        totalInstitutes,
        totalStudents,
        activeTeachers,
        inactiveInstitutes,
        recentInstitutes: recentInstitutes.map(i => ({
          id: i.id,
          name: i.name,
          code: i.code,
          city: i.city,
          isActive: i.isActive,
          createdAt: i.createdAt,
          adminName: i.users[0]?.fullName || '—',
          studentCount: i._count.users,
        })),
        alerts,
      };
    }, 30); // 30-second TTL — fast enough to feel live
  }

  async getAdminDashboard(instituteId: string) {
    return cacheGet(DASHBOARD_KEYS.admin(instituteId), async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalFaculty,
        totalStudents,
        totalClasses,
        totalRevenue,
        pendingDuesCount,
        sessionsThisMonth,
        recentEnrollments,
        pendingVerifications,
      ] = await Promise.all([
        prisma.user.count({ where: { instituteId, role: 'TEACHER', isDeleted: false } }),
        prisma.student.count({ where: { instituteId, isDeleted: false } }),
        prisma.tuitionClass.count({ where: { instituteId, isDeleted: false } }),
        prisma.paymentDue.aggregate({
          where: { student: { instituteId }, status: 'PAID', paidAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
        prisma.paymentDue.count({
          where: { student: { instituteId }, status: { in: ['UNPAID', 'PAYMENT_READY'] } },
        }),
        prisma.attendanceSession.count({
          where: { class: { instituteId }, startedAt: { gte: monthStart } },
        }),
        prisma.studentEnrollment.findMany({
          where: { class: { instituteId }, subscriptionStatus: { not: 'CANCELLED' } },
          orderBy: { enrolledAt: 'desc' },
          take: 5,
          include: {
            student: { include: { user: { select: { fullName: true } } } },
            class: { select: { name: true } },
          },
        }),
        prisma.student.count({ where: { instituteId, verificationStatus: 'PENDING_VERIFICATION' } }),
      ]);

      const alerts: { type: string; message: string }[] = [];
      if (pendingDuesCount > 0) alerts.push({ type: 'warning', message: `${pendingDuesCount} unpaid dues pending` });
      if (pendingVerifications > 0) alerts.push({ type: 'pending', message: `${pendingVerifications} students awaiting verification` });

      return {
        totalFaculty,
        totalStudents,
        totalClasses,
        totalRevenue: Number(totalRevenue._sum.amount) || 0,
        pendingDues: pendingDuesCount,
        sessionsThisMonth,
        recentEnrollments,
        pendingVerifications,
        alerts,
      };
    }, 30); // 30-second TTL
  }

  async getTeacherDashboard(teacherId: string) {
    return cacheGet(DASHBOARD_KEYS.teacher(teacherId), async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [upcomingClasses, sessionsThisMonth, attendanceStats] = await Promise.all([
        prisma.tuitionClass.findMany({
          where: { teacherId, isDeleted: false },
          include: {
            _count: {
              select: {
                enrollments: { where: { subscriptionStatus: { not: 'CANCELLED' } } },
                materials: true,
              },
            },
          },
        }),
        prisma.attendanceSession.count({ where: { teacherId, startedAt: { gte: monthStart } } }),
        prisma.attendanceRecord.aggregate({
          where: { session: { teacherId } },
          _count: { _all: true },
        }),
      ]);

      const totalStudents = upcomingClasses.reduce((sum, c) => sum + c._count.enrollments, 0);
      const totalSessions = await prisma.attendanceSession.count({ where: { teacherId } });
      const presentCount = attendanceStats._count._all;
      const totalPossible = totalSessions * totalStudents;
      const avgAttendance = totalPossible > 0
        ? Math.round((presentCount / totalPossible) * 100)
        : 0;

      return {
        totalClasses: upcomingClasses.length,
        totalStudents,
        sessionsThisMonth,
        avgAttendance,
        upcomingClasses,
      };
    }, 30); // 30-second TTL
  }

  async getProductAnalytics() {
    const now = new Date();
    // Last 6 months labels
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { label: d.toLocaleString('default', { month: 'short', year: '2-digit' }), start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
    });

    // Monthly institute registrations
    const instituteGrowth = await Promise.all(
      months.map(m => prisma.institute.count({ where: { createdAt: { gte: m.start, lt: m.end }, isDeleted: false } }))
    );

    // Monthly student registrations
    const studentGrowth = await Promise.all(
      months.map(m => prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: m.start, lt: m.end }, isDeleted: false } }))
    );

    // Monthly revenue (paid dues)
    const revenueByMonth = await Promise.all(
      months.map(m => prisma.paymentDue.aggregate({
        where: { status: 'PAID', paidAt: { gte: m.start, lt: m.end } },
        _sum: { amount: true },
      }))
    );

    // Monthly attendance sessions
    const sessionsByMonth = await Promise.all(
      months.map(m => prisma.attendanceSession.count({ where: { startedAt: { gte: m.start, lt: m.end } } }))
    );

    // Top 5 institutes by student count
    const topInstitutes = await prisma.institute.findMany({
      where: { isDeleted: false },
      select: {
        id: true, name: true, city: true, isActive: true,
        _count: {
          select: {
            users: { where: { role: 'STUDENT', isDeleted: false } },
          },
        },
      },
      orderBy: { users: { _count: 'desc' } },
      take: 5,
    });

    // Platform totals
    const [
      totalInstitutes, activeInstitutes,
      totalStudents, totalTeachers,
      totalClasses, totalEnrollments,
      totalRevenue, totalSessions,
      totalAttendanceRecords,
    ] = await Promise.all([
      prisma.institute.count({ where: { isDeleted: false } }),
      prisma.institute.count({ where: { isDeleted: false, isActive: true } }),
      prisma.user.count({ where: { role: 'STUDENT', isDeleted: false } }),
      prisma.user.count({ where: { role: 'TEACHER', isDeleted: false } }),
      prisma.tuitionClass.count({ where: { isDeleted: false } }),
      prisma.studentEnrollment.count({ where: { subscriptionStatus: { not: 'CANCELLED' } } }),
      prisma.paymentDue.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.attendanceSession.count(),
      prisma.attendanceRecord.count(),
    ]);

    const avgAttendanceRate = totalSessions > 0 && totalEnrollments > 0
      ? Math.round((totalAttendanceRecords / (totalSessions * totalEnrollments)) * 100)
      : 0;

    return {
      labels: months.map(m => m.label),
      instituteGrowth,
      studentGrowth,
      revenueByMonth: revenueByMonth.map(r => Number(r._sum.amount) || 0),
      sessionsByMonth,
      topInstitutes: topInstitutes.map(i => ({
        id: i.id, name: i.name, city: i.city, isActive: i.isActive,
        studentCount: i._count.users,
      })),
      totals: {
        totalInstitutes, activeInstitutes,
        totalStudents, totalTeachers,
        totalClasses, totalEnrollments,
        totalRevenue: Number(totalRevenue._sum.amount) || 0,
        totalSessions,
        avgAttendanceRate,
      },
    };
  }

  async getStudentDashboard(userId: string) {
    const student = await prisma.student.findFirst({
      where: { userId },
      include: {
        enrollments: {
          where: { subscriptionStatus: { not: 'CANCELLED' } },
          include: {
            class: {
              select: { id: true, name: true, subject: true, grade: true, scheduleDays: true, startTime: true, teacher: { select: { fullName: true } } },
            },
          },
        },
      },
    });

    if (!student) return null;

    const classIds = student.enrollments.map((e) => e.classId);

    const [attendanceCount, totalSessions, pendingDuesAgg, totalMaterials] = await Promise.all([
      prisma.attendanceRecord.count({ where: { studentId: student.id } }),
      prisma.attendanceSession.count({ where: { classId: { in: classIds } } }),
      prisma.paymentDue.aggregate({
        where: { studentId: student.id, status: { in: ['UNPAID', 'PAYMENT_READY'] } },
        _sum: { amount: true },
      }),
      prisma.classMaterial.count({ where: { classId: { in: classIds }, isVisible: true } }),
    ]);

    return {
      enrolledClasses: student.enrollments.length,
      attendanceRate: totalSessions > 0 ? Math.round((attendanceCount / totalSessions) * 100) : 0,
      pendingDues: Number(pendingDuesAgg._sum.amount) || 0,
      totalMaterials,
      dob: student.dob ?? null,
    };
  }
}

export const dashboardService = new DashboardService();
