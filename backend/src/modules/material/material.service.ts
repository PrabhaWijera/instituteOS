import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { decodeStoredUrl } from '../../utils/decodeStoredUrl';
import cloudinary from '../../config/cloudinary';
import { cloudinaryCircuit } from '../../config/resilience';
import { withRetry } from '../../utils/retry';
import logger from '../../utils/logger';

class MaterialService {
  async create(classId: string, uploadedById: string, role: string, data: { title: string; type: string; url: string }) {
    if (role === 'TEACHER') {
      const cls = await prisma.tuitionClass.findFirst({ where: { id: classId, teacherId: uploadedById, isDeleted: false } });
      if (!cls) throw new ApiError(403, 'You can only upload materials to your own classes');
    }
    const material = await prisma.classMaterial.create({
      data: {
        classId,
        uploadedById,
        title: data.title,
        type: data.type as any,
        url: decodeStoredUrl(data.url),
        isVisible: true,
      },
    });
    return { ...material, url: decodeStoredUrl(material.url) };
  }

  async getByClass(classId: string, role: string, userId: string) {
    if (role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { userId } });
      if (!student) throw new ApiError(403, 'Student profile not found');
      const enrolled = await prisma.studentEnrollment.findFirst({
        where: { classId, studentId: student.id, subscriptionStatus: { not: 'CANCELLED' } },
      });
      if (!enrolled) throw new ApiError(403, 'You are not enrolled in this class');
    }
    if (role === 'TEACHER') {
      const cls = await prisma.tuitionClass.findFirst({ where: { id: classId, teacherId: userId, isDeleted: false } });
      if (!cls) throw new ApiError(403, 'You can only view materials for your own classes');
    }
    if (role === 'PARENT') {
      // Parent must be linked to at least one student enrolled in this class
      const linkedStudents = await prisma.parentStudentLink.findMany({
        where: { parentId: userId },
        select: { studentId: true },
      });
      const studentIds = linkedStudents.map(l => l.studentId);
      if (studentIds.length === 0) throw new ApiError(403, 'No linked children found');
      const enrolled = await prisma.studentEnrollment.findFirst({
        where: { classId, studentId: { in: studentIds }, subscriptionStatus: { not: 'CANCELLED' } },
      });
      if (!enrolled) throw new ApiError(403, 'None of your children are enrolled in this class');
    }

    const where: any = { classId };
    if (role === 'STUDENT' || role === 'PARENT') where.isVisible = true;

    const rows = await prisma.classMaterial.findMany({
      where,
      include: {
        uploadedBy: { select: { fullName: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({ ...row, url: decodeStoredUrl(row.url) }));
  }

  async toggleVisibility(id: string, userId: string, role: string) {
    const material = await prisma.classMaterial.findUnique({ where: { id } });
    if (!material) throw new ApiError(404, 'Material not found');

    if (role === 'TEACHER' && material.uploadedById !== userId) {
      throw new ApiError(403, 'You can only modify your own materials');
    }

    const updated = await prisma.classMaterial.update({
      where: { id },
      data: { isVisible: !material.isVisible },
    });
    return { ...updated, url: decodeStoredUrl(updated.url) };
  }

  async delete(id: string, userId: string, role: string) {
    const material = await prisma.classMaterial.findUnique({ where: { id } });
    if (!material) throw new ApiError(404, 'Material not found');

    if (role === 'TEACHER' && material.uploadedById !== userId) {
      throw new ApiError(403, 'You can only delete your own materials');
    }

    // Delete from Cloudinary if PDF — non-critical, never blocks the DB delete
    if (material.type === 'PDF' && material.url.includes('cloudinary')) {
      try {
        const uploadIndex = material.url.indexOf('/upload/');
        if (uploadIndex !== -1) {
          const afterUpload = material.url.slice(uploadIndex + 8);
          const withoutVersion = afterUpload.replace(/^v\d+\//, '');
          const publicId = withoutVersion.replace(/\.[^.]+$/, '');
          const resourceType = material.url.includes('/raw/') ? 'raw' : 'auto';

          await cloudinaryCircuit.execute(() =>
            withRetry(
              () => cloudinary.uploader.destroy(publicId, { resource_type: resourceType }),
              { maxAttempts: 2, initialDelayMs: 300, operationName: 'cloudinary-delete' },
            ),
          );
        }
      } catch (err) {
        // Cloudinary deletion failure is non-critical — log and continue
        logger.warn('[Material] Cloudinary delete failed (non-critical)', {
          materialId: id,
          circuitState: cloudinaryCircuit.getState(),
          error: (err as Error).message,
        });
      }
    }

    await prisma.classMaterial.delete({ where: { id } });
    return { message: 'Material deleted' };
  }
}

export const materialService = new MaterialService();
