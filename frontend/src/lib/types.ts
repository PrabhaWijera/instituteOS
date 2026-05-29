// ============ API Response Types ============
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// ============ User / Auth ============
export type Role = 'SUPER_ADMIN' | 'INSTITUTE_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  profileImage?: string;
  isActive: boolean;
  instituteId?: string;
  lastLoginAt?: string;
  createdAt: string;
  student?: StudentProfile;
}

// ============ Institute ============
export interface Institute {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  subscriptionPlan: string;
  isActive: boolean;
  lat?: number;
  lng?: number;
  teacherCount?: number;
  studentCount?: number;
  classCount?: number;
  createdAt: string;
}

// ============ Class ============
export interface TuitionClass {
  id: string;
  name: string;
  subject: string;
  grade: string;
  schedule: string;
  scheduleDays?: string[];
  startTime?: string;
  durationMinutes?: number;
  feeAmount: number;
  maxStudents?: number;
  isActive?: boolean;
  isDeleted: boolean;
  teacher?: Pick<User, 'id' | 'fullName' | 'email'>;
  enrollments?: Enrollment[];
  _count?: { enrollments: number };
  createdAt: string;
}

// ============ Student ============
export type VerificationStatus = 'PENDING_PROFILE' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export interface StudentProfile {
  id: string;
  userId: string;
  instituteId: string;
  grade: string;
  gender?: string;
  dob?: string;
  address?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  verificationStatus: VerificationStatus;
  isDeleted: boolean;
  user?: Pick<User, 'id' | 'fullName' | 'email' | 'profileImage' | 'isActive' | 'createdAt'>;
  enrollments?: Enrollment[];
  _count?: { enrollments: number };
  createdAt: string;
}

// ============ Enrollment ============
export type SubscriptionStatus = 'ACTIVE' | 'PAYMENT_DUE' | 'SUSPENDED' | 'CANCELLED';

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  subscriptionStatus: SubscriptionStatus;
  nextBillingDate: string;
  class?: Pick<TuitionClass, 'id' | 'name' | 'subject' | 'feeAmount'>;
}

// ============ Attendance ============
export interface AttendanceSession {
  id: string;
  classId: string;
  teacherId: string;
  otp: string;
  otpCode?: string;
  status?: 'ONGOING' | 'ENDED';
  isActive: boolean;
  lat?: number;
  lng?: number;
  radiusMeters: number;
  expiresAt: string;
  startedAt?: string;
  endedAt?: string;
  class?: Pick<TuitionClass, 'id' | 'name' | 'subject'>;
  records?: AttendanceRecord[];
  _count?: { records: number };
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT';
  markedAt: string;
  session?: AttendanceSession;
}

// ============ Payment ============
export type PaymentStatus = 'UNPAID' | 'PAYMENT_DUE' | 'PAYMENT_READY' | 'SUSPENDED' | 'PAID';

export interface PaymentDue {
  id: string;
  studentId: string;
  enrollmentId: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  status: PaymentStatus;
  paidAt?: string;
  paymentMethod?: string;
  readyAt?: string;
  notes?: string;
  student?: StudentProfile;
  enrollment?: Enrollment;
  recordedBy?: Pick<User, 'fullName'>;
  createdAt: string;
}

// ============ Material ============
export interface Material {
  id: string;
  classId: string;
  uploadedById: string;
  title: string;
  type: 'PDF' | 'VIDEO_LINK' | 'LIVE_LINK';
  url: string;
  isVisible: boolean;
  class?: Pick<TuitionClass, 'id' | 'name'>;
  createdAt: string;
}

// ============ Notification ============
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

// ============ AI ============
export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// ============ Dashboard ============
export interface DashboardStats {
  totalInstitutes?: number;
  totalUsers?: number;
  totalStudents?: number;
  totalClasses?: number;
  totalFaculty?: number;
  totalRevenue?: number;
  attendanceRate?: number;
  pendingVerifications?: number;
  sessionsThisMonth?: number;
  avgAttendance?: number;
  enrolledClasses?: number;
  pendingDues?: number;
  totalMaterials?: number;
  dob?: string | null;
}
