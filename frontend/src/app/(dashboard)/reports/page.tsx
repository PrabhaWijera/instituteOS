'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, UserCheck, UserX, ShieldAlert, Activity } from 'lucide-react';
import { getInitials, formatDate, formatCurrency } from '@/lib/utils';
import type { TuitionClass } from '@/lib/types';
import logger from '@/lib/logger';

type Tab = 'session' | 'monthly' | 'payments';

export default function ReportsPage() {
  const [classes, setClasses] = useState<TuitionClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('session');
  const [selectedClass, setSelectedClass] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionReport, setSessionReport] = useState<any>(null);

  useEffect(() => {
    api.get('/classes/my').then(({ data }) => {
      const cls = data.data || [];
      setClasses(cls);
      if (cls.length > 0) setSelectedClass(cls[0].id);
    }).catch(err => logger.error('Load classes failed', err)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    api.get(`/attendance/sessions?classId=${selectedClass}`).then(({ data }) => {
      setSessions(data.data || []);
    }).catch(() => setSessions([]));
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedSession) { setSessionReport(null); return; }
    api.get(`/attendance/sessions/${selectedSession}/report`).then(({ data }) => {
      setSessionReport(data.data);
    }).catch(() => setSessionReport(null));
  }, [selectedSession]);

  if (loading) return <Loading />;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'session', label: 'Session Report' },
    { key: 'monthly', label: 'Monthly Summary' },
    { key: 'payments', label: 'Payment Status' },
  ];

  // Report endpoint returns { session, presentCount, absentCount, totalEnrolled, manualCount, rate }
  // session.records contains only present students (records only exist when marked present)
  const present = sessionReport?.session?.records || [];
  const absentCount = sessionReport?.absentCount ?? 0;
  const total = sessionReport?.totalEnrolled ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="View attendance and payment reports" />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Session Report */}
      {tab === 'session' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSession(''); }}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>
                {sessions.map(s => <SelectItem key={s.id} value={s.id}>{formatDate(s.startedAt)} — {s.status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {sessionReport && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard title="Present" value={present.length} icon={UserCheck} />
                <StatCard title="Absent" value={absentCount} icon={UserX} />
                <StatCard title="Rate" value={total > 0 ? `${sessionReport?.rate ?? 0}%` : '0%'} icon={Activity} />
                <StatCard title="Manual" value={sessionReport?.manualCount ?? 0} icon={Users} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base text-green-600">Present ({present.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {present.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between rounded border p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{getInitials(r.student?.user?.fullName || '?')}</AvatarFallback></Avatar>
                          <span className="text-sm">{r.student?.user?.fullName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={r.isManual ? 'warning' : 'default'} className="text-[10px]">{r.isManual ? 'Manual' : 'OTP'}</Badge>
                          <span className="text-xs text-muted-foreground">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : ''}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base text-red-600">Absent ({absentCount})</CardTitle></CardHeader>
                  <CardContent>
                    {absentCount === 0 ? (
                      <p className="text-sm text-muted-foreground">Full attendance!</p>
                    ) : (
                      <div className="flex items-center gap-2 rounded border p-3 bg-red-50 dark:bg-red-950/30">
                        <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="text-sm text-red-700 dark:text-red-300">{absentCount} student{absentCount > 1 ? 's' : ''} did not attend this session.</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* Monthly Summary */}
      {tab === 'monthly' && (
        <div className="space-y-4">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Card>
            <CardHeader><CardTitle className="text-base">Sessions This Month</CardTitle></CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions this month.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Present</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{formatDate(s.startedAt)}</TableCell>
                        <TableCell><Badge variant={s.status === 'ONGOING' ? 'default' : 'secondary'} className="text-xs">{s.status}</Badge></TableCell>
                        <TableCell className="text-sm">{s._count?.records ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Status (Read-only) */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-3 text-sm text-blue-700 dark:text-blue-300">
            You can view payment status here. To record a payment, ask the institute admin.
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <PaymentStatusTable classId={selectedClass} />
        </div>
      )}
    </div>
  );
}

function PaymentStatusTable({ classId }: { classId: string }) {
  const [dues, setDues] = useState<any[]>([]);

  useEffect(() => {
    if (!classId) return;
    api.get(`/payments/class/${classId}`).then(({ data }) => setDues(data.data || [])).catch(() => setDues([]));
  }, [classId]);

  if (dues.length === 0) return <p className="text-sm text-muted-foreground">No payment data.</p>;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dues.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="text-sm">{d.student?.user?.fullName || '—'}</TableCell>
                <TableCell>
                  <Badge variant={d.status === 'PAID' ? 'success' : d.status === 'PAYMENT_READY' ? 'warning' : 'destructive'} className="text-xs">
                    {d.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{formatCurrency(d.amount)}</TableCell>
                <TableCell className="text-sm">{formatDate(d.periodEnd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
