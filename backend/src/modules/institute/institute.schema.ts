import { z } from 'zod';

export const createInstituteSchema = z.object({
  name: z.string().min(3, 'Institute name must be at least 3 characters'),
  code: z.string().min(3).max(10).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  phone: z.string().min(1, 'Phone is required'),
  subscriptionPlan: z.enum(['FREE', 'BASIC', 'PRO']).default('FREE'),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  adminName: z.string().min(2, 'Admin name is required'),
  adminEmail: z.string().email('Invalid admin email'),
  adminPhone: z.string().optional(),
});

export const updateInstituteSchema = z.object({
  name: z.string().min(3).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  subscriptionPlan: z.enum(['FREE', 'BASIC', 'PRO']).optional(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

export const updateInstituteStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateInstituteSettingsSchema = z.object({
  gracePeriodDays: z.number().min(0).max(30).optional(),
  autoSuspendAfterDays: z.number().min(1).max(60).optional(),
  billingCycleDays: z.number().min(7).max(90).optional(),
  currency: z.enum(['LKR', 'USD']).optional(),
  requireGps: z.boolean().optional(),
  geofenceRadiusMeters: z.number().min(50).max(5000).optional(),
  otpExpiryMinutes: z.number().min(5).max(60).optional(),
  allowManualOverride: z.boolean().optional(),
  attendanceBlockOnDue: z.boolean().optional(),
  autoPaymentReminders: z.boolean().optional(),
  allowPartialPayments: z.boolean().optional(),
  notifyParentInvite: z.boolean().optional(),
  notifyEnrollment: z.boolean().optional(),
  notifyFeeDue: z.boolean().optional(),
  notifyAbsent: z.boolean().optional(),
  notifyPaymentReceipt: z.boolean().optional(),
});

export type CreateInstituteInput = z.infer<typeof createInstituteSchema>;
export type UpdateInstituteInput = z.infer<typeof updateInstituteSchema>;
export type UpdateInstituteSettingsInput = z.infer<typeof updateInstituteSettingsSchema>;
