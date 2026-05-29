"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInstituteSettingsSchema = exports.updateInstituteStatusSchema = exports.updateInstituteSchema = exports.createInstituteSchema = void 0;
const zod_1 = require("zod");
exports.createInstituteSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, 'Institute name must be at least 3 characters'),
    code: zod_1.z.string().min(3).max(10).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
    address: zod_1.z.string().min(1, 'Address is required'),
    city: zod_1.z.string().min(1, 'City is required'),
    phone: zod_1.z.string().min(1, 'Phone is required'),
    subscriptionPlan: zod_1.z.enum(['FREE', 'BASIC', 'PRO']).default('FREE'),
    lat: zod_1.z.number().min(-90).max(90).optional(),
    lng: zod_1.z.number().min(-180).max(180).optional(),
    adminName: zod_1.z.string().min(2, 'Admin name is required'),
    adminEmail: zod_1.z.string().email('Invalid admin email'),
    adminPhone: zod_1.z.string().optional(),
});
exports.updateInstituteSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    subscriptionPlan: zod_1.z.enum(['FREE', 'BASIC', 'PRO']).optional(),
    lat: zod_1.z.number().min(-90).max(90).optional().nullable(),
    lng: zod_1.z.number().min(-180).max(180).optional().nullable(),
});
exports.updateInstituteStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
exports.updateInstituteSettingsSchema = zod_1.z.object({
    gracePeriodDays: zod_1.z.number().min(0).max(30).optional(),
    autoSuspendAfterDays: zod_1.z.number().min(1).max(60).optional(),
    billingCycleDays: zod_1.z.number().min(7).max(90).optional(),
    currency: zod_1.z.enum(['LKR', 'USD']).optional(),
    requireGps: zod_1.z.boolean().optional(),
    geofenceRadiusMeters: zod_1.z.number().min(100).max(5000).optional(),
    otpExpiryMinutes: zod_1.z.number().min(5).max(60).optional(),
    allowManualOverride: zod_1.z.boolean().optional(),
    attendanceBlockOnDue: zod_1.z.boolean().optional(),
    autoPaymentReminders: zod_1.z.boolean().optional(),
    allowPartialPayments: zod_1.z.boolean().optional(),
    notifyParentInvite: zod_1.z.boolean().optional(),
    notifyEnrollment: zod_1.z.boolean().optional(),
    notifyFeeDue: zod_1.z.boolean().optional(),
    notifyAbsent: zod_1.z.boolean().optional(),
    notifyPaymentReceipt: zod_1.z.boolean().optional(),
});
