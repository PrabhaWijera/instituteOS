'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Lock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { StudentProfile } from '@/lib/types';
import logger from '@/lib/logger';

export default function ParentAttendancePage() {
  const [children, setChildren] = useState<StudentProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/parent/children').then(({ data }) => {
      const kids = data.data || [];
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0].id);
    }).catch(err => logger.error('Load children failed', err)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    api.get(`/parent/children/${selectedChild}/attendance`).then(({ data }) => {
      setAttendance(data.data || []);
    }).catch(() => setAttendance([]));
  }, [selectedChild]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="View your child's attendance records" />

      {children.length > 1 && (
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Select child" /></SelectTrigger>
          <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.user?.fullName}</SelectItem>)}</SelectContent>
        </Select>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Attendance History</CardTitle></CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.checkInTime || r.createdAt)}</TableCell>
                    <TableCell className="text-sm">{r.session?.class?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="success" className="text-xs">
                        {r.isManual ? 'PRESENT (Manual)' : 'PRESENT'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{r.isManual ? 'Manual' : 'OTP'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
        <Lock className="h-4 w-4 shrink-0" />
        This is read-only. If you see an error in the attendance records, contact the institute admin.
      </div>
    </div>
  );
}
