'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { DashboardSkeleton, PageLoading } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, GraduationCap, BookOpen,
  CreditCard, ClipboardCheck, TrendingUp, Activity,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DashboardStats, Institute, TuitionClass, StudentProfile } from '@/lib/types';
import logger from '@/lib/logger';

interface SuperAdminData extends DashboardStats {
  activeTeachers?: number;
  inactiveInstitutes?: number;
  recentInstitutes?: Array<{ id: string; name: string; code: string; city: string; isActive: boolean; createdAt: string; adminName: string; studentCount: number }>;
  alerts?: Array<{ type: string; message: string }>;
}

interface AdminData extends DashboardStats {
  recentEnrollments?: Array<{ id: string; student?: { user?: { fullName: string } }; class?: { name: string }; enrolledAt: string }>;
  alerts?: Array<{ type: string; message: string }>;
}

interface TeacherData extends DashboardStats {
  upcomingClasses?: TuitionClass[];
}

type StudentData = DashboardStats;

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'from-violet-600 to-indigo-600',
  INSTITUTE_ADMIN: 'from-blue-600 to-cyan-500',
  TEACHER: 'from-emerald-500 to-teal-600',
  STUDENT: 'from-orange-500 to-pink-500',
  PARENT: 'from-rose-500 to-pink-600',
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  INSTITUTE_ADMIN: 'Institute Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<SuperAdminData | AdminData | TeacherData | StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'PARENT') { setLoading(false); return; }
    const endpoint = `/dashboard/${user.role === 'SUPER_ADMIN' ? 'super-admin' :
      user.role === 'INSTITUTE_ADMIN' ? 'admin' :
      user.role === 'TEACHER' ? 'teacher' : 'student'}`;

    api.get(endpoint).then(({ data: res }) => {
      setData(res.data);
    }).catch((err) => logger.error('Failed to load dashboard', err)).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <DashboardSkeleton />;
  if (user?.role === 'PARENT') return <ParentDashboard />;
  if (!data || !user) return null;

  const gradient = ROLE_COLORS[user.role] || 'from-violet-600 to-indigo-600';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className={`relative rounded-2xl bg-gradient-to-r ${gradient} p-6 text-white overflow-hidden`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">{greeting} 👋</p>
            <h1 className="text-2xl font-bold">{user.fullName.split(' ')[0]}</h1>
            <p className="text-white/70 text-sm mt-1">{ROLE_LABEL[user.role]} · {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/15 backdrop-blur-sm items-center justify-center text-3xl font-bold">
            {user.fullName.charAt(0)}
          </div>
        </div>
      </div>

      {user.role === 'SUPER_ADMIN' && <SuperAdminDashboard data={data} />}
      {user.role === 'INSTITUTE_ADMIN' && <AdminDashboard data={data} />}
      {user.role === 'TEACHER' && <TeacherDashboard data={data} />}
      {user.role === 'STUDENT' && <StudentDashboard data={data} userId={user.id} />}
    </div>
  );
}

function AlertBadge({ type, message }: { type: string; message: string }) {
  const styles: Record<string, string> = {
    new: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400',
    pending: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400',
    warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400',
    error: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400',
  };
  const icons: Record<string, string> = { new: '✦', pending: '⏳', warning: '⚠️', error: '🚨' };
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${styles[type] || styles.error}`}>
      <span className="mt-0.5 text-base leading-none">{icons[type] || '●'}</span>
      <span>{message}</span>
    </div>
  );
}

function ActivityRow({ left, sub, right }: { left: string; sub?: string; right?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 rounded-full bg-primary/10 items-center justify-center text-primary font-semibold text-xs">
          {left.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium leading-none">{left}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      {right && <span className="text-xs text-muted-foreground">{right}</span>}
    </div>
  );
}

function SuperAdminDashboard({ data }: { data: SuperAdminData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Institutes" value={data.totalInstitutes ?? 0} icon={Building2} className="border-l-4 border-l-violet-500" />
        <StatCard title="Total Students" value={data.totalStudents ?? 0} icon={GraduationCap} className="border-l-4 border-l-blue-500" />
        <StatCard title="Active Teachers" value={data.activeTeachers ?? 0} icon={Users} className="border-l-4 border-l-emerald-500" />
        <StatCard title="Inactive Institutes" value={data.inactiveInstitutes ?? 0} icon={Building2} className="border-l-4 border-l-red-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {(data.recentInstitutes?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold">Recent Institutes</CardTitle>
                <a href="/institutes" className="text-xs text-primary hover:underline font-medium">View all →</a>
              </CardHeader>
              <CardContent className="pt-0">
                {data.recentInstitutes!.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-sm">
                        {inst.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inst.name}</p>
                        <p className="text-xs text-muted-foreground">{inst.adminName} · {inst.studentCount} students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={inst.isActive ? 'success' : 'destructive'}>{inst.isActive ? 'Active' : 'Inactive'}</Badge>
                      <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(inst.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
        <div>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Platform Alerts</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {(data.alerts?.length ?? 0) === 0
                ? <p className="text-sm text-muted-foreground py-4 text-center">✓ No alerts right now</p>
                : data.alerts!.map((a, i) => <AlertBadge key={i} type={a.type} message={a.message} />)
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ data }: { data: AdminData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Students" value={data.totalStudents ?? 0} icon={GraduationCap} className="border-l-4 border-l-blue-500" />
        <StatCard title="Total Faculty" value={data.totalFaculty ?? 0} icon={Users} className="border-l-4 border-l-violet-500" />
        <StatCard title="Active Classes" value={data.totalClasses ?? 0} icon={BookOpen} className="border-l-4 border-l-emerald-500" />
        <StatCard title="Revenue (MTD)" value={formatCurrency(data.totalRevenue ?? 0)} icon={TrendingUp} className="border-l-4 border-l-amber-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {(data.alerts?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Alerts</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-2">
                {data.alerts!.map((a, i) => <AlertBadge key={i} type={a.type} message={a.message} />)}
              </CardContent>
            </Card>
          )}
          {(data.recentEnrollments?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Recent Enrollments</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {data.recentEnrollments!.map((e) => (
                  <ActivityRow key={e.id} left={e.student?.user?.fullName || '—'} sub={e.class?.name} right={formatDate(e.enrolledAt)} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Quick Actions</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              <a href="/students" className="group flex items-center justify-between rounded-xl border p-3.5 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-sm font-medium">Pending Verifications</span>
                </div>
                <Badge variant="warning">{data.pendingVerifications ?? 0}</Badge>
              </a>
              <a href="/attendance" className="group flex items-center justify-between rounded-xl border p-3.5 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium">Sessions This Month</span>
                </div>
                <Badge variant="secondary">{data.sessionsThisMonth ?? 0}</Badge>
              </a>
              <a href="/payments" className="group flex items-center justify-between rounded-xl border p-3.5 hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="text-sm font-medium">Overdue Payments</span>
                </div>
                <Badge variant="destructive">{data.pendingDues ?? 0}</Badge>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeacherDashboard({ data }: { data: TeacherData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="My Classes" value={data.totalClasses ?? 0} icon={BookOpen} className="border-l-4 border-l-emerald-500" />
        <StatCard title="Total Students" value={data.totalStudents ?? 0} icon={GraduationCap} className="border-l-4 border-l-blue-500" />
        <StatCard title="Sessions This Month" value={data.sessionsThisMonth || 0} icon={ClipboardCheck} className="border-l-4 border-l-violet-500" />
        <StatCard title="Avg Attendance" value={`${data.avgAttendance || 0}%`} icon={Activity} className="border-l-4 border-l-amber-500" />
      </div>
      {(data.upcomingClasses?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">My Classes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.upcomingClasses!.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    {c.subject?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.subject} · Grade {c.grade}</p>
                  </div>
                </div>
                <Badge variant="secondary">{c._count?.enrollments || 0} students</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const MOTIVATIONAL_QUOTES = [
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { quote: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { quote: "Learning is not attained by chance; it must be sought with ardor.", author: "Abigail Adams" },
  { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { quote: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { quote: "Strive for progress, not perfection.", author: "Unknown" },
  { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { quote: "Great things never come from comfort zones.", author: "Unknown" },
  { quote: "Dream it. Wish it. Do it.", author: "Unknown" },
  { quote: "Work hard in silence, let success make the noise.", author: "Frank Ocean" },
  { quote: "Little by little, a little becomes a lot.", author: "Tanzanian Proverb" },
  { quote: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy" },
  { quote: "You are braver than you believe, stronger than you seem.", author: "A.A. Milne" },
  { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
];

function StudentDashboard({ data, userId }: { data: StudentData; userId: string }) {
  const attendance = data.attendanceRate || 0;
  const attendanceColor = attendance >= 75 ? 'border-l-emerald-500' : attendance >= 50 ? 'border-l-amber-500' : 'border-l-red-500';

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];

  const isBirthday = (() => {
    if (!data.dob) return false;
    const dob = new Date(data.dob);
    return dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate();
  })();

  const birthdayKey = `bday_shown_${userId}_${todayStr}`;
  const [showBirthday, setShowBirthday] = useState(() => {
    if (!isBirthday) return false;
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(birthdayKey);
  });

  function dismissBirthday() {
    localStorage.setItem(birthdayKey, '1');
    setShowBirthday(false);
  }

  return (
    <div className="space-y-6">
      {showBirthday && (
        <div className="relative rounded-2xl overflow-hidden border border-yellow-300/50 dark:border-yellow-700/40 bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-950/30 dark:via-amber-950/30 dark:to-orange-950/30 p-5">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl select-none">🎂</div>
              <div>
                <p className="text-base font-bold text-amber-700 dark:text-amber-300">Happy Birthday! 🎉</p>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-0.5">Wishing you a wonderful day full of joy and success. Keep shining!</p>
              </div>
            </div>
            <button onClick={dismissBirthday} className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-xl leading-none" aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Enrolled Classes" value={data.enrolledClasses ?? 0} icon={BookOpen} className="border-l-4 border-l-blue-500" />
        <StatCard title="Attendance Rate" value={`${attendance}%`} icon={ClipboardCheck} className={`border-l-4 ${attendanceColor}`} />
        <StatCard title="Pending Dues" value={formatCurrency(data.pendingDues || 0)} icon={CreditCard} className="border-l-4 border-l-amber-500" />
        <StatCard title="Materials" value={data.totalMaterials || 0} icon={Activity} className="border-l-4 border-l-violet-500" />
      </div>

      <div className="relative rounded-2xl border bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 dark:from-orange-950/20 dark:via-pink-950/20 dark:to-violet-950/20 p-5 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-orange-200/30 dark:bg-orange-800/10 -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-violet-200/30 dark:bg-violet-800/10 translate-y-6 -translate-x-6" />
        <div className="relative flex items-start gap-4">
          <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-lg">
            ✦
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 dark:text-orange-400 mb-1">Quote of the Day</p>
            <p className="text-base font-medium text-foreground leading-relaxed">&ldquo;{quote.quote}&rdquo;</p>
            <p className="text-sm text-muted-foreground mt-1.5">— {quote.author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParentDashboard() {
  useEffect(() => {
    window.location.href = '/children';
  }, []);
  return <PageLoading />;
}
