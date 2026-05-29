'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Baby, BookOpen, ClipboardCheck, CreditCard, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { StudentProfile, AttendanceRecord, PaymentDue, Material } from '@/lib/types';
import logger from '@/lib/logger';

interface ChildData {
  attendance: AttendanceRecord[];
  payments: PaymentDue[];
  materials: Material[];
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState('');
  const [childData, setChildData] = useState<ChildData | null>(null);

  useEffect(() => {
    api.get('/parent/children').then(({ data }) => {
      const kids = data.data || [];
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0].id);
    }).catch((err) => logger.error('Failed to load children', err)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    Promise.all([
      api.get(`/parent/children/${selectedChild}/attendance`),
      api.get(`/parent/children/${selectedChild}/payments`),
      api.get(`/parent/children/${selectedChild}/materials`),
    ]).then(([att, pay, mat]) => {
      setChildData({
        attendance: att.data.data || [],
        payments: pay.data.data || [],
        materials: mat.data.data || [],
      });
    }).catch((err) => logger.error('Failed to load child data', err));
  }, [selectedChild]);

  if (loading) return <Loading />;

  const child = children.find(c => c.id === selectedChild);
  const presentCount = childData?.attendance.filter(r => r.status === 'PRESENT').length || 0;
  const totalAttendance = childData?.attendance.length || 0;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
  const unpaidDues = childData?.payments.filter(p => p.status !== 'PAID') || [];
  const totalUnpaid = unpaidDues.reduce((s, p) => s + p.amount, 0);
  const hasSuspended = unpaidDues.some(p => (p.status as string) === 'SUSPENDED');
  const classCount = child?.enrollments?.length || 0;
  const materialCount = childData?.materials.length || 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Monitor your child's progress">
        {children.length > 1 && (
          <Select value={selectedChild} onValueChange={setSelectedChild}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Switch child" /></SelectTrigger>
            <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.user?.fullName}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </PageHeader>

      {children.length === 0 ? (
        <EmptyState title="No children linked" description="Ask the institute to link your parent account to your child" icon={Baby} />
      ) : (
        <>
          {/* Alert banner */}
          {hasSuspended && (
            <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-4">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Attendance Blocked</p>
                <p className="text-xs text-red-600 dark:text-red-400">Your child&apos;s fee is overdue and attendance has been suspended. Contact the institute immediately.</p>
              </div>
            </div>
          )}

          {/* Child header */}
          {child && (
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold">{child.user?.fullName}</h2>
                <div className="flex gap-2 mt-0.5">
                  <Badge variant="secondary">Grade {child.grade}</Badge>
                  <Badge variant={child.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} className="text-xs">{child.verificationStatus.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Attendance Rate" value={`${attendanceRate}%`} icon={Activity} />
            <StatCard title="Pending Fees" value={formatCurrency(totalUnpaid)} icon={CreditCard} />
            <StatCard title="Enrolled Classes" value={classCount} icon={BookOpen} />
            <StatCard title="Materials" value={materialCount} icon={BookOpen} />
          </div>

          {/* Quick panels */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent attendance */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Attendance</CardTitle>
                <Button variant="ghost" size="sm" asChild><Link href="/children/attendance">View All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(childData?.attendance || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attendance records yet.</p>
                ) : (
                  (childData?.attendance || []).slice(0, 5).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <p className="text-sm">{r.session?.class?.name || 'Class'}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.markedAt || r.createdAt)}</p>
                      </div>
                      <Badge variant={r.status === 'PRESENT' ? 'success' : 'destructive'} className="text-xs">{r.status}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Fee status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Fee Status</CardTitle>
                <Button variant="ghost" size="sm" asChild><Link href="/children/fees">View All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {unpaidDues.length === 0 ? (
                  <p className="text-sm text-green-600">All fees are up to date.</p>
                ) : (
                  unpaidDues.slice(0, 5).map((p: any) => (
                    <div key={p.id} className={`flex items-center justify-between rounded border p-2 ${(p.status as string) === 'SUSPENDED' ? 'border-red-300 bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                      <div>
                        <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.periodStart)} — {formatDate(p.periodEnd)}</p>
                      </div>
                      <Badge variant={p.status === 'PAID' ? 'success' : (p.status as string) === 'SUSPENDED' ? 'destructive' : 'warning'} className="text-xs">
                        {(p.status as string).replace('_', ' ')}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick nav */}
          <div className="grid gap-3 md:grid-cols-3">
            <Link href="/children/attendance">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  <div><p className="text-sm font-medium">Attendance Records</p><p className="text-xs text-muted-foreground">View full attendance history</p></div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/children/fees">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div><p className="text-sm font-medium">Fee Details</p><p className="text-xs text-muted-foreground">View dues and payment history</p></div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/children/classes">
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div><p className="text-sm font-medium">Classes & Materials</p><p className="text-xs text-muted-foreground">View enrolled classes and materials</p></div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
