'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Building2, Users, GraduationCap, BookOpen,
  CreditCard, ClipboardCheck, TrendingUp, Activity,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import logger from '@/lib/logger';

interface Analytics {
  labels: string[];
  instituteGrowth: number[];
  studentGrowth: number[];
  revenueByMonth: number[];
  sessionsByMonth: number[];
  topInstitutes: Array<{ id: string; name: string; city: string; isActive: boolean; studentCount: number }>;
  totals: {
    totalInstitutes: number;
    activeInstitutes: number;
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalEnrollments: number;
    totalRevenue: number;
    totalSessions: number;
    avgAttendanceRate: number;
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/analytics')
      .then(({ data: res }) => setData(res.data))
      .catch(err => logger.error('Failed to load analytics', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data) return <p className="text-muted-foreground p-8">Failed to load analytics.</p>;

  const { totals, labels } = data;

  // Build chart data arrays from parallel arrays
  const growthData = labels.map((label, i) => ({
    month: label,
    Institutes: data.instituteGrowth[i],
    Students: data.studentGrowth[i],
  }));

  const revenueData = labels.map((label, i) => ({
    month: label,
    Revenue: data.revenueByMonth[i],
  }));

  const sessionsData = labels.map((label, i) => ({
    month: label,
    Sessions: data.sessionsByMonth[i],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Analytics"
        description="Platform-wide growth, revenue, and engagement metrics"
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Institutes" value={totals.totalInstitutes} icon={Building2}
          description={`${totals.activeInstitutes} active`} />
        <StatCard title="Total Students" value={totals.totalStudents} icon={GraduationCap} />
        <StatCard title="Total Teachers" value={totals.totalTeachers} icon={Users} />
        <StatCard title="Total Revenue" value={formatCurrency(totals.totalRevenue)} icon={CreditCard} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Classes" value={totals.totalClasses} icon={BookOpen} />
        <StatCard title="Active Enrollments" value={totals.totalEnrollments} icon={TrendingUp} />
        <StatCard title="Attendance Sessions" value={totals.totalSessions} icon={ClipboardCheck} />
        <StatCard title="Avg Attendance Rate" value={`${totals.avgAttendanceRate}%`} icon={Activity} />
      </div>

      {/* Growth chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Growth (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={growthData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInstitutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="Institutes" stroke="#8b5cf6" fill="url(#colorInstitutes)" strokeWidth={2} />
              <Area type="monotone" dataKey="Students" stroke="#06b6d4" fill="url(#colorStudents)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue (LKR)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sessions chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance Sessions per Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={sessionsData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="Sessions" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top institutes table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Institutes by Student Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topInstitutes.map((inst, idx) => (
              <div key={inst.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">#{idx + 1}</span>
                  <div>
                    <p className="font-medium text-sm">{inst.name}</p>
                    <p className="text-xs text-muted-foreground">{inst.city || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{inst.studentCount} students</span>
                  <Badge variant={inst.isActive ? 'success' : 'secondary'} className="text-xs">
                    {inst.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            ))}
            {data.topInstitutes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
