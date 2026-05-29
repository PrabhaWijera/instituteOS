'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { PageLoading } from '@/components/shared/loading';
import {
  Building2, Users, GraduationCap, BookOpen, ClipboardCheck,
  CreditCard, Bot, FileText, BarChart3, Shield, Zap, Globe,
  ChevronRight, Check, Star, ArrowRight,
} from 'lucide-react';

const ROLES = [
  {
    key: 'admin',
    label: 'Institute Admin',
    emoji: '🏫',
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    description: 'Full control over your institute operations',
    capabilities: [
      { icon: Users, text: 'Invite & manage faculty members' },
      { icon: GraduationCap, text: 'Register & verify students' },
      { icon: BookOpen, text: 'Create and schedule classes' },
      { icon: CreditCard, text: 'Track payments & fee dues' },
      { icon: ClipboardCheck, text: 'View attendance reports' },
      { icon: BarChart3, text: 'Analytics & insights dashboard' },
    ],
  },
  {
    key: 'teacher',
    label: 'Teacher',
    emoji: '👨‍🏫',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    description: 'Manage your classes and students effortlessly',
    capabilities: [
      { icon: ClipboardCheck, text: 'Start live OTP-based attendance sessions' },
      { icon: Users, text: 'Manually mark & override attendance' },
      { icon: FileText, text: 'Upload class materials & resources' },
      { icon: BarChart3, text: 'Session reports & attendance rates' },
      { icon: BookOpen, text: 'View enrolled students per class' },
      { icon: Zap, text: 'Real-time WebSocket attendance board' },
    ],
  },
  {
    key: 'student',
    label: 'Student',
    emoji: '🎓',
    color: 'from-orange-500 to-pink-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    description: 'Your academic life, all in one place',
    capabilities: [
      { icon: ClipboardCheck, text: 'Mark attendance with GPS-verified OTP' },
      { icon: BookOpen, text: 'View enrolled classes & schedules' },
      { icon: Bot, text: 'Ask the AI Tutor any subject question' },
      { icon: FileText, text: 'Download class materials anytime' },
      { icon: CreditCard, text: 'Track fee dues & payment history' },
      { icon: Shield, text: 'Profile verification workflow' },
    ],
  },
  {
    key: 'parent',
    label: 'Parent',
    emoji: '👨‍👩‍👧',
    color: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800',
    text: 'text-rose-700 dark:text-rose-300',
    description: 'Stay connected with your child\'s education',
    capabilities: [
      { icon: ClipboardCheck, text: 'Monitor child\'s attendance in real-time' },
      { icon: CreditCard, text: 'View fee dues & payment records' },
      { icon: BookOpen, text: 'See enrolled classes & subjects' },
      { icon: GraduationCap, text: 'Track academic progress' },
      { icon: Shield, text: 'Get notified on important updates' },
      { icon: Globe, text: 'Access from any device, anywhere' },
    ],
  },
  {
    key: 'superadmin',
    label: 'Super Admin',
    emoji: '⚡',
    color: 'from-violet-600 to-indigo-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    text: 'text-violet-700 dark:text-violet-300',
    description: 'Platform-wide oversight and control',
    capabilities: [
      { icon: Building2, text: 'Create & manage all institutes' },
      { icon: Users, text: 'Platform-wide user management' },
      { icon: BarChart3, text: 'Cross-institute analytics' },
      { icon: Shield, text: 'Activate / deactivate institutes' },
      { icon: Globe, text: 'Global platform settings' },
      { icon: Zap, text: 'Onboard new institutes instantly' },
    ],
  },
];

const FEATURES = [
  { icon: ClipboardCheck, title: 'GPS + OTP Attendance', desc: 'Students scan a live OTP and verify their location. Teachers see a real-time live board.', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  { icon: Bot, title: 'AI Tutor', desc: 'Socratic-style AI tutor supports English, Sinhala, and Bilingual responses for any subject.', color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
  { icon: CreditCard, title: 'Fee Management', desc: 'Automated billing cycles, payment dues tracking, and overdue alerts built in.', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  { icon: FileText, title: 'Class Materials', desc: 'Teachers upload resources; students access them anytime from their portal.', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
  { icon: BarChart3, title: 'Reports & Analytics', desc: 'Attendance rates, session history, revenue tracking — all in visual dashboards.', color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30' },
  { icon: Shield, title: 'Role-based Access', desc: '5 distinct roles with scoped permissions: Super Admin, Admin, Teacher, Student, Parent.', color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30' },
];

const STEPS = [
  { step: '01', title: 'Admin creates the institute', desc: 'Super Admin onboards the institute. The Institute Admin gets an email invite and sets up their account.' },
  { step: '02', title: 'Add faculty & students', desc: 'Admin invites teachers and registers students. Everyone gets an email with their login details.' },
  { step: '03', title: 'Classes go live', desc: 'Teachers start sessions, students mark attendance with OTP, parents track progress — all in real time.' },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [activeRole, setActiveRole] = useState(0);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <PageLoading />;
  if (isAuthenticated) return <PageLoading />;

  const role = ROLES[activeRole];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-violet-500/20">
              iO
            </div>
            <div>
              <span className="text-base font-bold leading-none">instituteOS</span>
              <span className="block text-[10px] text-muted-foreground tracking-wide">MANAGEMENT</span>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 transition-all"
          >
            Sign In <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-background to-indigo-50 dark:from-violet-950/20 dark:via-background dark:to-indigo-950/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-violet-400/15 to-transparent rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Built for Sri Lankan tuition institutes
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
            The all-in-one platform for{' '}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              modern institutes
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Manage faculty, students, classes, attendance, fees, and AI-powered tutoring — all in one beautifully designed platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#roles"
              className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-sm font-semibold hover:bg-muted transition-all"
            >
              See how it works <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: '5', label: 'User Roles' },
              { value: 'OTP', label: 'GPS Attendance' },
              { value: 'AI', label: 'Built-in Tutor' },
              { value: '∞', label: 'Students & Classes' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border bg-card/80 backdrop-blur p-4 shadow-sm">
                <p className="text-3xl font-bold bg-gradient-to-br from-violet-600 to-indigo-600 bg-clip-text text-transparent">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Everything you need, nothing you don't</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Purpose-built features for tuition institutes, from attendance to AI.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border bg-card p-6 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.color} mb-4`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role-by-role */}
      <section id="roles" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Designed for every role</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Each user gets a tailored experience — no clutter, just what they need.</p>
          </div>

          {/* Role tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {ROLES.map((r, i) => (
              <button
                key={r.key}
                onClick={() => setActiveRole(i)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all border ${
                  activeRole === i
                    ? `bg-gradient-to-r ${r.color} text-white border-transparent shadow-lg`
                    : 'bg-card border hover:border-primary/30 hover:bg-muted'
                }`}
              >
                <span>{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>

          {/* Role detail card */}
          <div className={`rounded-2xl border ${role.border} ${role.bg} p-8 transition-all duration-300`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${role.color} text-3xl shadow-lg`}>
                {role.emoji}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">{role.label}</h3>
                <p className={`text-sm font-medium mb-5 ${role.text}`}>{role.description}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {role.capabilities.map((cap, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl bg-background/70 backdrop-blur border border-white/40 dark:border-white/10 px-3.5 py-2.5">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${role.color} text-white`}>
                        <cap.icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium">{cap.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Up and running in minutes</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">No complex setup. Just three steps and your institute is live.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative rounded-2xl border bg-card p-6 hover:shadow-md transition-all">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-10 right-0 translate-x-1/2 z-10 text-muted-foreground/30 text-2xl font-bold">›</div>
                )}
                <div className="text-4xl font-black bg-gradient-to-br from-violet-600/20 to-indigo-600/20 bg-clip-text text-transparent mb-4 leading-none">{s.step}</div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 p-12 text-white shadow-2xl shadow-violet-500/20">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            <div className="relative">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}
              </div>
              <h2 className="text-3xl font-bold mb-3">Ready to modernize your institute?</h2>
              <p className="text-white/70 mb-8 max-w-lg mx-auto">Your institute admin credentials are set up by the platform. Sign in and get started right away.</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-violet-700 font-semibold px-8 py-3.5 shadow-xl hover:bg-white/90 hover:scale-[1.02] transition-all"
              >
                Sign In to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-white/60 text-sm">
                {['No setup fees', 'Role-based access', 'AI Tutor included', 'Real-time attendance'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xs font-bold">
              iO
            </div>
            <span className="font-semibold">instituteOS</span>
          </div>
          <p className="text-sm text-muted-foreground">Built for modern tuition institutes · All rights reserved</p>
          <Link href="/login" className="text-sm text-primary font-medium hover:underline">
            Sign In →
          </Link>
        </div>
      </footer>
    </div>
  );
}
