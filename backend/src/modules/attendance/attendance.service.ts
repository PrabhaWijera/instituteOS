import prisma from '../../config/prisma';
import redis from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { generateOTP } from '../../utils/otp';
import { haversineMeters } from '../../utils/haversine';
import { broadcastAttendance } from './websocket.handler';
import { env } from '../../config/env';
import { StartSessionInput, VerifyOtpInput, ManualMarkInput } from './attendance.schema';
import logger from '../../utils/logger';
import { notificationService } from '../notification/notification.service';

// ---------------------------------------------------------------------------
// Redis helpers with graceful degradation
// OTP data is always persisted in the DB (session.otpCode), so Redis is an
// optional fast-path.  If it is down, we fall back to the DB value.
// ---------------------------------------------------------------------------

async function redisSafeGet(key: string): Promise<string | null> {
  try {
    const val = await redis.get(key);
    if (val == null) return null;
    return String(val);
  } catch (err) {
    logger.warn('[Attendance] Redis GET failed — falling back to DB OTP', {
      key,
      error: (err as Error).message,
    });
    return null;
  }
}

async function redisSafeSet(key: string, value: string, exSeconds: number): Promise<void> {
  try {
    // Always store as string — Upstash may return numbers otherwise and break OTP compare
    await redis.set(key, String(value), { ex: exSeconds });
  } catch (err) {
    logger.warn('[Attendance] Redis SET failed — OTP will be served from DB', {
      key,
      error: (err as Error).message,
    });
  }
}

async function redisSafeDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn('[Attendance] Redis DEL failed — OTP TTL will rely on session end check', {
      key,
      error: (err as Error).message,
    });
  }
}

// ---------------------------------------------------------------------------

class AttendanceService {
  async startSession(data: StartSessionInput, teacherId: string, instituteId: string) {
    const tuitionClass = await prisma.tuitionClass.findFirst({
      where: { id: data.classId, instituteId, isDeleted: false },
      include: { institute: { include: { settings: true } } },
    });
    if (!tuitionClass) throw new ApiError(404, 'Class not found');
    if (tuitionClass.teacherId !== teacherId) throw new ApiError(403, 'You are not the assigned teacher for this class');

    const existingSession = await prisma.attendanceSession.findFirst({
      where: { classId: data.classId, status: 'ONGOING' },
    });
    if (existingSession) throw new ApiError(409, 'There is already an ongoing session for this class');

    const otpCode = generateOTP();
    const otpExpiry = tuitionClass.institute.settings?.otpExpiryMinutes ?? 10;

    const session = await prisma.attendanceSession.create({
      data: { classId: data.classId, teacherId, otpCode },
      include: { class: { select: { name: true, subject: true } } },
    });

    // Store OTP in Redis (best-effort; DB is the source of truth)
    await redisSafeSet(`otp:${session.id}`, otpCode, otpExpiry * 60);

    return { ...session, otpCode, otpExpiryMinutes: otpExpiry };
  }

  async getSessions(instituteId: string, teacherId?: string, classId?: string) {
    const where: any = { class: { instituteId } };
    if (teacherId) where.teacherId = teacherId;
    if (classId) where.classId = classId;

    return prisma.attendanceSession.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, subject: true, grade: true } },
        teacher: { select: { fullName: true } },
        _count: { select: { records: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async getSessionById(id: string, instituteId: string) {
    const session = await prisma.attendanceSession.findFirst({
      where: { id, class: { instituteId } },
      include: {
        class: { select: { id: true, name: true, subject: true, grade: true, instituteId: true } },
        teacher: { select: { fullName: true } },
        records: {
          include: {
            student: { include: { user: { select: { fullName: true } } } },
            markedBy: { select: { fullName: true } },
          },
        },
      },
    });
    if (!session) throw new ApiError(404, 'Session not found');
    return session;
  }

  async endSession(id: string, teacherId: string) {
    const session = await prisma.attendanceSession.findFirst({
      where: { id, teacherId },
      include: { class: { select: { id: true, name: true, instituteId: true } } },
    });
    if (!session) throw new ApiError(404, 'Session not found');
    if (session.status === 'COMPLETED') throw new ApiError(400, 'Session already ended');

    // Remove OTP from Redis (best-effort; session status in DB prevents further use)
    await redisSafeDel(`otp:${id}`);

    const completed = await prisma.attendanceSession.update({
      where: { id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });

    // Fire absent notifications (non-blocking)
    this.notifyAbsentStudents(session.classId, id, session.class.name, session.class.instituteId).catch(() => {});

    return completed;
  }

  private async notifyAbsentStudents(classId: string, sessionId: string, className: string, instituteId: string) {
    // Get all active enrollments for this class
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { classId, subscriptionStatus: { not: 'CANCELLED' } },
      include: { student: { include: { user: { select: { id: true, fullName: true } }, parentLinks: { include: { parent: true } } } } },
    });

    // Get the set of studentIds who attended
    const records = await prisma.attendanceRecord.findMany({ where: { sessionId }, select: { studentId: true } });
    const attendedIds = new Set(records.map(r => r.studentId));

    for (const enrollment of enrollments) {
      if (attendedIds.has(enrollment.studentId)) continue;
      const student = enrollment.student;

      // Notify the absent student
      notificationService.notifyIfEnabled('notifyAbsent', {
        userId: student.userId,
        instituteId,
        title: 'Absence Recorded',
        message: `You were marked absent for the ${className} session.`,
        type: 'ATTENDANCE',
      });

      // Notify linked parents
      for (const link of student.parentLinks) {
        notificationService.notifyIfEnabled('notifyAbsent', {
          userId: link.parentId,
          instituteId,
          title: 'Child Absent',
          message: `${student.user.fullName} was absent from the ${className} session.`,
          type: 'ATTENDANCE',
        });
      }
    }
  }

  async getSessionReport(id: string, instituteId: string) {
    const session = await prisma.attendanceSession.findFirst({
      where: { id, class: { instituteId } },
      include: {
        class: { select: { id: true, name: true } },
        records: {
          include: {
            student: { include: { user: { select: { fullName: true } } } },
          },
        },
      },
    });
    if (!session) throw new ApiError(404, 'Session not found');

    const totalEnrolled = await prisma.studentEnrollment.count({
      where: { classId: session.classId, subscriptionStatus: { not: 'CANCELLED' } },
    });

    const presentCount = session.records.length;
    const absentCount = totalEnrolled - presentCount;
    const manualCount = session.records.filter((r) => r.isManual).length;

    return {
      session,
      presentCount,
      absentCount,
      totalEnrolled,
      manualCount,
      rate: totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0,
    };
  }

  async verifyOtp(userId: string, data: VerifyOtpInput) {
    const student = await prisma.student.findFirst({
      where: { userId },
      include: { user: { select: { fullName: true } } },
    });
    if (!student) throw new ApiError(404, 'Student not found');

    // STEP 1 — Find active session for this class
    const session = await prisma.attendanceSession.findFirst({
      where: { classId: data.classId, status: 'ONGOING' },
      include: { class: { include: { institute: { include: { settings: true } } } } },
    });
    if (!session) throw new ApiError(404, 'No active session for this class');

    // STEP 2 — Verify OTP (DB is source of truth; Redis can be stale or return numeric types)
    const submitted = data.otpCode.trim();
    const dbOtp = String(session.otpCode).trim();
    if (submitted !== dbOtp) {
      const redisOtp = await redisSafeGet(`otp:${session.id}`);
      const redisOtpStr = redisOtp != null ? String(redisOtp).trim() : null;
      if (submitted !== redisOtpStr) {
        throw new ApiError(400, 'Invalid OTP code');
      }
    }

    // STEP 3 — Geofence check
    let distance = 0;
    const settings = session.class.institute.settings;
    const bypassGeo = env.BYPASS_GEOFENCING === 'true';

    if (!bypassGeo && settings?.requireGps !== false) {
      const institute = session.class.institute;
      if (!institute.lat || !institute.lng) {
        throw new ApiError(400, 'Institute location not set. Contact your admin.');
      }
      distance = haversineMeters(data.latitude, data.longitude, institute.lat, institute.lng);
      const radius = settings?.geofenceRadiusMeters ?? 1000;
      if (distance > radius) {
        throw new ApiError(403, `You are ${Math.round(distance)}m away. Must be within ${radius}m.`);
      }
    }

    // STEP 4 — Payment status check
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, classId: data.classId },
    });
    if (!enrollment) throw new ApiError(403, 'You are not enrolled in this class');

    if (settings?.attendanceBlockOnDue !== false) {
      if (enrollment.subscriptionStatus === 'PAYMENT_DUE' || enrollment.subscriptionStatus === 'SUSPENDED') {
        throw new ApiError(403, 'Attendance blocked. Please clear your outstanding fees.');
      }
    }

    // STEP 5 — Check not already marked
    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    });
    if (existing) throw new ApiError(409, 'Attendance already marked for this session');

    // STEP 6 — Write record
    const record = await prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: student.id,
        latitude: data.latitude,
        longitude: data.longitude,
        distanceMeters: distance,
        isManual: false,
      },
    });

    // STEP 7 — Broadcast to teacher's live board
    const presentCount = await prisma.attendanceRecord.count({ where: { sessionId: session.id } });
    const totalEnrolled = await prisma.studentEnrollment.count({
      where: { classId: data.classId, subscriptionStatus: { not: 'CANCELLED' } },
    });

    broadcastAttendance(session.id, {
      studentId: student.id,
      studentName: student.user.fullName,
      checkInTime: record.checkInTime.toISOString(),
      isManual: false,
      presentCount,
      totalEnrolled,
    });

    return {
      ...record,
      className: session.class.name,
      presentCount,
      totalEnrolled,
    };
  }

  async manualMark(data: ManualMarkInput, markedById: string) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: data.sessionId },
      include: { class: true },
    });
    if (!session) throw new ApiError(404, 'Session not found');
    if (session.class.teacherId !== markedById) throw new ApiError(403, 'You can only manually mark attendance for your own classes');

    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      include: { user: { select: { fullName: true } } },
    });
    if (!student) throw new ApiError(404, 'Student not found');

    if (data.status === 'PRESENT') {
      const existing = await prisma.attendanceRecord.findUnique({
        where: { sessionId_studentId: { sessionId: data.sessionId, studentId: data.studentId } },
      });
      if (existing) throw new ApiError(409, 'Student already marked present');

      const record = await prisma.attendanceRecord.create({
        data: {
          sessionId: data.sessionId,
          studentId: data.studentId,
          checkInTime: data.checkInTime ? new Date(data.checkInTime) : new Date(),
          isManual: true,
          markedById,
          reason: data.reason,
        },
      });

      const presentCount = await prisma.attendanceRecord.count({ where: { sessionId: data.sessionId } });
      const totalEnrolled = await prisma.studentEnrollment.count({
        where: { classId: session.classId, subscriptionStatus: { not: 'CANCELLED' } },
      });

      broadcastAttendance(data.sessionId, {
        studentId: data.studentId,
        studentName: student.user.fullName,
        checkInTime: record.checkInTime.toISOString(),
        isManual: true,
        presentCount,
        totalEnrolled,
      });

      return record;
    }

    return { message: 'Student marked as absent', studentId: data.studentId, sessionId: data.sessionId };
  }

  async getStudentHistory(userId: string) {
    const student = await prisma.student.findFirst({ where: { userId } });
    if (!student) throw new ApiError(404, 'Student not found');

    return prisma.attendanceRecord.findMany({
      where: { studentId: student.id },
      include: {
        session: {
          include: { class: { select: { name: true, subject: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getClassHistory(classId: string, instituteId: string) {
    return prisma.attendanceSession.findMany({
      where: { classId, class: { instituteId } },
      include: {
        teacher: { select: { fullName: true } },
        _count: { select: { records: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
  }
}

export const attendanceService = new AttendanceService();
