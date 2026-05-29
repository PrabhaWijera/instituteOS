"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.instituteService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const ApiError_1 = require("../../utils/ApiError");
const hash_1 = require("../../utils/hash");
const invite_1 = require("../../utils/invite");
const pagination_1 = require("../../utils/pagination");
const crypto_1 = __importDefault(require("crypto"));
const notification_service_1 = require("../notification/notification.service");
class InstituteService {
    async create(data, createdByUserId) {
        const existingCode = await prisma_1.default.institute.findUnique({
            where: { code: data.code },
        });
        if (existingCode) {
            throw new ApiError_1.ApiError(409, 'Institute code already exists');
        }
        const existingEmail = await prisma_1.default.user.findUnique({
            where: { email: data.adminEmail },
        });
        if (existingEmail) {
            throw new ApiError_1.ApiError(409, 'Admin email already in use');
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
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
            const tempPassword = crypto_1.default.randomBytes(16).toString('hex');
            const adminUser = await tx.user.create({
                data: {
                    email: data.adminEmail,
                    passwordHash: await (0, hash_1.hashPassword)(tempPassword),
                    fullName: data.adminName,
                    phone: data.adminPhone,
                    role: 'INSTITUTE_ADMIN',
                    isActive: false,
                    instituteId: institute.id,
                },
            });
            // Create invite
            const token = (0, invite_1.generateInviteToken)();
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
        notification_service_1.notificationService.sendEmail('instituteCreated', {
            to: data.adminEmail,
            adminName: data.adminName,
            instituteName: data.name,
            inviteLink: result.inviteToken,
        });
        return result;
    }
    async findAll(pagination, search) {
        const where = { isDeleted: false };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [institutes, total] = await Promise.all([
            prisma_1.default.institute.findMany({
                where: where,
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
            prisma_1.default.institute.count({ where: where }),
        ]);
        const mapped = institutes.map((inst) => ({
            ...inst,
            teacherCount: inst._count.users,
            studentCount: inst._count.students,
            classCount: inst._count.classes,
            _count: undefined,
        }));
        return (0, pagination_1.paginatedResponse)(mapped, total, pagination);
    }
    async findById(id) {
        const institute = await prisma_1.default.institute.findFirst({
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
            throw new ApiError_1.ApiError(404, 'Institute not found');
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
    async update(id, data) {
        const institute = await prisma_1.default.institute.findUnique({ where: { id } });
        if (!institute)
            throw new ApiError_1.ApiError(404, 'Institute not found');
        return prisma_1.default.institute.update({
            where: { id },
            data,
        });
    }
    async updateStatus(id, isActive) {
        const institute = await prisma_1.default.institute.findUnique({ where: { id } });
        if (!institute)
            throw new ApiError_1.ApiError(404, 'Institute not found');
        return prisma_1.default.institute.update({
            where: { id },
            data: { isActive },
        });
    }
    async delete(id) {
        const institute = await prisma_1.default.institute.findUnique({ where: { id } });
        if (!institute)
            throw new ApiError_1.ApiError(404, 'Institute not found');
        // Soft delete — marks institute and all its data as deleted so they
        // disappear from every list, but no FK rows are physically removed.
        await prisma_1.default.$transaction([
            prisma_1.default.institute.update({
                where: { id },
                data: { isActive: false, isDeleted: true, deletedAt: new Date() },
            }),
            prisma_1.default.user.updateMany({
                where: { instituteId: id },
                data: { isActive: false, isDeleted: true },
            }),
            prisma_1.default.student.updateMany({
                where: { instituteId: id },
                data: { isDeleted: true },
            }),
            prisma_1.default.tuitionClass.updateMany({
                where: { instituteId: id },
                data: { isDeleted: true },
            }),
            prisma_1.default.userInvite.deleteMany({ where: { instituteId: id } }),
        ]);
        return { message: 'Institute deleted successfully' };
    }
    async getOwnInstitute(instituteId) {
        const institute = await prisma_1.default.institute.findUnique({
            where: { id: instituteId },
            include: { settings: true },
        });
        if (!institute)
            throw new ApiError_1.ApiError(404, 'Institute not found');
        return institute;
    }
    async updateOwnInstitute(instituteId, data) {
        return prisma_1.default.institute.update({
            where: { id: instituteId },
            data,
        });
    }
    async getSettings(instituteId) {
        const settings = await prisma_1.default.instituteSettings.findUnique({
            where: { instituteId },
        });
        if (!settings)
            throw new ApiError_1.ApiError(404, 'Settings not found');
        return settings;
    }
    async updateSettings(instituteId, data) {
        return prisma_1.default.instituteSettings.upsert({
            where: { instituteId },
            update: data,
            create: { instituteId, ...data },
        });
    }
}
exports.instituteService = new InstituteService();
