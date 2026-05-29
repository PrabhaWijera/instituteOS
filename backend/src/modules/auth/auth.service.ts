import prisma from '../../config/prisma';
import redis from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, JwtPayload } from '../../utils/jwt';
import { generateInviteToken } from '../../utils/invite';
import { Role } from '@prisma/client';
import crypto from 'crypto';
import logger from '../../utils/logger';
import { RegisterOwnerInput, LoginInput, AcceptInviteInput, ChangePasswordInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schema';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AuthService {
  async registerOwner(data: RegisterOwnerInput) {
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (existingSuperAdmin) {
      throw new ApiError(409, 'Super admin already exists. Only one super admin is allowed.');
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || user.isDeleted) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Your account has been deactivated. Contact your administrator.');
    }

    // If the user belongs to an institute, check that the institute is active and not deleted
    if (user.instituteId) {
      const institute = await prisma.institute.findUnique({
        where: { id: user.instituteId },
        select: { isActive: true, isDeleted: true },
      });
      if (!institute || institute.isDeleted) {
        throw new ApiError(403, 'Your institute no longer exists. Contact the platform administrator.');
      }
      if (!institute.isActive) {
        throw new ApiError(403, 'Your institute has been deactivated. Contact the platform administrator.');
      }
    }

    // Account lockout check
    const lockoutKey = `lockout:${user.id}`;
    const attemptsKey = `login_attempts:${user.id}`;
    const lockoutUntil = await redis.get(lockoutKey);
    if (lockoutUntil) {
      const remaining = Math.ceil((parseInt(lockoutUntil as string) - Date.now()) / 60000);
      throw new ApiError(429, `Account locked due to too many failed attempts. Try again in ${remaining} minute(s).`);
    }

    const isValid = await comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      const attempts = parseInt((await redis.get(attemptsKey) as string) || '0') + 1;
      await redis.set(attemptsKey, attempts.toString(), { ex: 900 }); // 15 min TTL

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await redis.set(lockoutKey, (Date.now() + LOCKOUT_DURATION_MS).toString(), { ex: 900 });
        await redis.del(attemptsKey);
        logger.warn('Account locked after failed login attempts', { email: user.email, userId: user.id });
        throw new ApiError(429, 'Account locked due to too many failed attempts. Try again in 15 minutes.');
      }

      throw new ApiError(401, `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - attempts} attempt(s) remaining.`);
    }

    // Clear attempts on success
    await redis.del(attemptsKey);
    await redis.del(lockoutKey);

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new ApiError(401, 'Refresh token expired');
    }

    const user = storedToken.user;

    if (!user.isActive || user.isDeleted) {
      throw new ApiError(403, 'Account is deactivated');
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
    };

    const accessToken = signAccessToken(payload);
    return { accessToken };
  }

  async logout(userId: string, refreshToken: string) {
    await prisma.refreshToken.deleteMany({
      where: { userId, token: refreshToken },
    });
  }

  async getInvite(token: string) {
    const invite = await prisma.userInvite.findUnique({ where: { token } });
    if (!invite) throw new ApiError(404, 'Invalid or expired invite link');
    if (invite.usedAt) throw new ApiError(400, 'This invite has already been used');
    if (invite.expiresAt < new Date()) throw new ApiError(400, 'This invite has expired');
    return { email: invite.email, role: invite.role };
  }

  async acceptInvite(data: AcceptInviteInput) {
    const invite = await prisma.userInvite.findUnique({
      where: { token: data.token },
    });

    if (!invite) {
      throw new ApiError(404, 'Invalid invite token');
    }

    if (invite.usedAt) {
      throw new ApiError(400, 'This invite has already been used');
    }

    if (invite.expiresAt < new Date()) {
      throw new ApiError(400, 'This invite has expired. Please request a new one.');
    }

    const passwordHash = await hashPassword(data.password);

    const { user: result, parentInvite } = await prisma.$transaction(async (tx) => {
      // Update user — set password and activate
      const user = await tx.user.update({
        where: { email: invite.email },
        data: {
          passwordHash,
          isActive: true,
        },
      });

      // Mark invite as used
      await tx.userInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      let parentInvite: { email: string; token: string; parentName: string; studentName: string; instituteId: string } | null = null;

      // If student with parentEmail — create parent account + invite
      if (invite.role === 'STUDENT') {
        const student = await tx.student.findFirst({
          where: { userId: user.id },
          include: { user: { select: { fullName: true } } },
        });

        if (student?.parentEmail) {
          const parentUser = await tx.user.upsert({
            where: { email: student.parentEmail },
            create: {
              email: student.parentEmail,
              passwordHash: await hashPassword(crypto.randomBytes(16).toString('hex')),
              fullName: student.parentName || 'Parent',
              role: 'PARENT',
              isActive: false,
              instituteId: student.instituteId,
            },
            update: {},
          });

          const parentToken = generateInviteToken();
          await tx.userInvite.create({
            data: {
              email: student.parentEmail,
              token: parentToken,
              role: 'PARENT',
              instituteId: student.instituteId,
              sentById: user.id,
              expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
          });

          await tx.parentStudentLink.upsert({
            where: {
              parentId_studentId: {
                parentId: parentUser.id,
                studentId: student.id,
              },
            },
            create: {
              parentId: parentUser.id,
              studentId: student.id,
            },
            update: {},
          });

          parentInvite = {
            email: student.parentEmail,
            token: parentToken,
            parentName: student.parentName || 'Parent',
            studentName: student.user?.fullName || user.fullName,
            instituteId: student.instituteId,
          };
        }
      }

      return { user, parentInvite };
    });

    // Send parent invite email after transaction commits (non-blocking)
    if (parentInvite) {
      const institute = await prisma.institute.findUnique({
        where: { id: parentInvite.instituteId },
        select: { name: true },
      });
      const { notificationService } = await import('../notification/notification.service');
      notificationService.sendEmail('parentInvited', {
        to: parentInvite.email,
        parentName: parentInvite.parentName,
        childName: parentInvite.studentName,
        instituteName: institute?.name || 'Your Institute',
        inviteLink: parentInvite.token,
      });
    }

    const { passwordHash: _, ...userWithoutPassword } = result;
    return userWithoutPassword;
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: { fullName?: string; phone?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'User not found');

    const isValid = await comparePassword(data.currentPassword, user.passwordHash);
    if (!isValid) throw new ApiError(400, 'Current password is incorrect');

    const passwordHash = await hashPassword(data.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);

    return { message: 'Password changed successfully. All sessions have been logged out.' };
  }

  async uploadProfileImage(userId: string, imageUrl: string) {
    // Fetch existing image URL to delete old asset from Cloudinary
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { profileImage: true } });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: imageUrl },
      select: { id: true, email: true, fullName: true, phone: true, role: true, profileImage: true, isActive: true },
    });

    // Delete old Cloudinary asset (best-effort, non-blocking)
    if (existing?.profileImage && existing.profileImage.includes('cloudinary.com')) {
      const parts = existing.profileImage.split('/');
      const fileWithExt = parts[parts.length - 1];
      const fileName = fileWithExt.split('.')[0];
      const folderIndex = parts.indexOf('nexclass');
      const publicId = folderIndex >= 0 ? `nexclass/${fileName}` : fileName;
      import('cloudinary').then(({ v2: cld }) => {
        cld.uploader.destroy(publicId).catch(() => {});
      });
    }

    return user;
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    // Always return success to prevent email enumeration
    if (!user || user.isDeleted || !user.isActive) {
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // Generate reset token, store in Redis with 1-hour TTL
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await redis.set(`pwd_reset:${tokenHash}`, user.id, { ex: 3600 });

    // Send email (non-blocking)
    const { notificationService } = await import('../notification/notification.service');
    notificationService.sendEmail('passwordReset', {
      to: user.email,
      userName: user.fullName,
      resetLink: resetToken,
    });

    logger.info('Password reset requested', { userId: user.id });
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  async resetPassword(data: ResetPasswordInput) {
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');
    const userId = await redis.get(`pwd_reset:${tokenHash}`);

    if (!userId) {
      throw new ApiError(400, 'Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(data.password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId as string },
        data: { passwordHash },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: userId as string },
      }),
    ]);

    // Clean up token
    await redis.del(`pwd_reset:${tokenHash}`);

    logger.info('Password reset completed', { userId });
    return { message: 'Password reset successfully. Please log in with your new password.' };
  }
}

export const authService = new AuthService();
