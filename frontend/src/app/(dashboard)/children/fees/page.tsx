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
import { formatDate, formatCurrency } from '@/lib/utils';
import type { StudentProfile } from '@/lib/types';
import logger from '@/lib/logger';

export default function ParentFeesPage() {
  const [children, setChildren] = useState<StudentProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
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
    api.get(`/parent/children/${selectedChild}/payments`).then(({ data }) => {
      setPayments(data.data || []);
    }).catch(() => setPayments([]));
  }, [selectedChild]);

  if (loading) return <Loading />;

  const current = payments.filter(p => p.status !== 'PAID');
  const history = payments.filter(p => p.status === 'PAID');

  return (
    <div className="space-y-6">
      <PageHeader title="Fees" description="View your child's fee status" />

      {children.length > 1 && (
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Select child" /></SelectTrigger>
          <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.user?.fullName}</SelectItem>)}</SelectContent>
        </Select>
      )}

      {/* Current dues */}
      {current.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Current Dues</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {current.map((p: any) => (
              <Card key={p.id} className={p.status === 'SUSPENDED' ? 'border-red-300' : p.status === 'PAYMENT_DUE' ? 'border-amber-300' : ''}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{p.class?.name || p.enrollment?.class?.name || 'Class'}</p>
                    <Badge variant={p.status === 'SUSPENDED' ? 'destructive' : p.status === 'PAYMENT_DUE' ? 'warning' : 'secondary'} className="text-xs">
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.periodStart)} — {formatDate(p.periodEnd)}</p>
                  {p.status === 'SUSPENDED' && (
                    <p className="text-xs text-red-600">Contact admin immediately.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment history.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{p.class?.name || p.enrollment?.class?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.periodStart)} — {formatDate(p.periodEnd)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(p.amount)}</TableCell>
                    <TableCell><Badge variant="success" className="text-xs">PAID</Badge></TableCell>
                    <TableCell className="text-sm">{p.paidAt ? formatDate(p.paidAt) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
        <Lock className="h-4 w-4 shrink-0" />
        Payments are recorded at the institute. Contact the admin to resolve any payment issues.
      </div>
    </div>
  );
}
