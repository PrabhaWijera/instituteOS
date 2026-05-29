'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreditCard, DollarSign, Users, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PaymentDue } from '@/lib/types';
import logger from '@/lib/logger';

export default function PaymentsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'INSTITUTE_ADMIN';
  const isStudent = user?.role === 'STUDENT';
  const [dues, setDues] = useState<PaymentDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dues' | 'report'>('dues');

  // Record payment dialog
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordDue, setRecordDue] = useState<PaymentDue | null>(null);
  const [recording, setRecording] = useState(false);
  const [payForm, setPayForm] = useState({ paymentMethod: 'CASH', amount: '', notes: '' });

  useEffect(() => { fetchDues(); }, []);

  async function fetchDues() {
    try {
      const endpoint = isStudent ? '/payments/me' : isAdmin ? '/payments' : '/payments';
      const { data } = await api.get(endpoint);
      setDues(data.data || []);
    } catch (err) { logger.error('Failed to load dues', err); } finally { setLoading(false); }
  }

  async function markReady(id: string) {
    try {
      await api.patch(`/payments/${id}/ready`);
      toast.success('Signalled ready to pay');
      fetchDues();
    } catch { toast.error('Failed'); }
  }

  function openRecord(due: PaymentDue) {
    setRecordDue(due);
    setPayForm({ paymentMethod: 'CASH', amount: String(due.amount), notes: '' });
    setRecordOpen(true);
  }

  async function handleRecord() {
    if (!recordDue) return;
    setRecording(true);
    try {
      await api.post(`/payments/${recordDue.id}/record`, {
        paymentMethod: payForm.paymentMethod,
        amount: parseFloat(payForm.amount),
        notes: payForm.notes || undefined,
      });
      toast.success('Payment recorded');
      setRecordOpen(false);
      fetchDues();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setRecording(false); }
  }

  if (loading) return <Loading />;

  const paid = dues.filter(d => d.status === 'PAID');
  const unpaid = dues.filter(d => d.status !== 'PAID');
  const totalCollected = paid.reduce((s, d) => s + d.amount, 0);
  const totalOutstanding = unpaid.reduce((s, d) => s + d.amount, 0);
  const ready = dues.filter(d => d.status === 'PAYMENT_READY');
  const suspended = dues.filter(d => d.status === 'SUSPENDED');

  const statusColor = (s: string) =>
    s === 'PAID' ? 'success' as const : s === 'PAYMENT_READY' ? 'warning' as const :
    s === 'SUSPENDED' ? 'destructive' as const : 'secondary' as const;

  return (
    <div className="space-y-6">
      <PageHeader title={isStudent ? 'My Fees' : 'Payments'} description={isStudent ? 'View and manage your fees' : 'Fee dues and payment records'} />

      {/* Admin tabs */}
      {isAdmin && (
        <div className="flex gap-1 border-b">
          <button onClick={() => setTab('dues')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'dues' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Fee Dues</button>
          <button onClick={() => setTab('report')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'report' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Monthly Report</button>
        </div>
      )}

      {/* KPI cards for admin */}
      {isAdmin && tab === 'dues' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Collected" value={formatCurrency(totalCollected)} icon={DollarSign} />
          <StatCard title="Outstanding" value={formatCurrency(totalOutstanding)} icon={CreditCard} />
          <StatCard title="Ready to Pay" value={ready.length} icon={Clock} />
          <StatCard title="Suspended" value={suspended.length} icon={Users} />
        </div>
      )}

      {/* Student view: due cards */}
      {isStudent && (
        <div className="space-y-4">
          {dues.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No fees due.</CardContent></Card>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {dues.map(due => (
                  <Card key={due.id} className={due.status === 'SUSPENDED' ? 'border-red-300' : due.status === 'PAYMENT_DUE' ? 'border-amber-300' : due.status === 'PAYMENT_READY' ? 'border-blue-300' : ''}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{(due as any).enrollment?.class?.name || 'Fee'}</p>
                        <Badge variant={statusColor(due.status)} className="text-xs">{due.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-xl font-bold">{formatCurrency(due.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(due.periodStart)} — {formatDate(due.periodEnd)}</p>
                      {due.status === 'UNPAID' && (
                        <Button size="sm" variant="outline" onClick={() => markReady(due.id)}>
                          <CreditCard className="h-3 w-3 mr-1" />Signal Ready to Pay
                        </Button>
                      )}
                      {due.status === 'PAYMENT_READY' && (
                        <p className="text-xs text-blue-600">Ready signalled — waiting for admin to record payment.</p>
                      )}
                      {due.status === 'SUSPENDED' && (
                        <p className="text-xs text-red-600">Your enrollment is suspended. Contact the institute admin.</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-3 text-sm text-blue-700 dark:text-blue-300">
                Cash payments are recorded by the institute admin. Use &quot;Signal ready&quot; to let the admin know you&apos;re bringing your payment.
              </div>
            </>
          )}
        </div>
      )}

      {/* Admin dues table */}
      {isAdmin && tab === 'dues' && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dues.map(due => (
                <TableRow key={due.id}
                  className={due.status === 'SUSPENDED' ? 'bg-red-50/50 dark:bg-red-950/20' :
                    due.status === 'PAYMENT_READY' ? 'bg-blue-50/50 dark:bg-blue-950/20' :
                    due.status === 'PAYMENT_DUE' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                  <TableCell className="text-sm">{due.student?.user?.fullName || '—'}</TableCell>
                  <TableCell className="text-sm">{(due as any).enrollment?.class?.name || '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(due.periodStart)} — {formatDate(due.periodEnd)}</TableCell>
                  <TableCell className="text-sm font-medium">{formatCurrency(due.amount)}</TableCell>
                  <TableCell><Badge variant={statusColor(due.status)} className="text-xs">{due.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-sm">{formatDate(due.periodEnd)}</TableCell>
                  <TableCell className="text-right">
                    {due.status !== 'PAID' && (
                      <Button size="sm" onClick={() => openRecord(due)}>Record</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Admin monthly report */}
      {isAdmin && tab === 'report' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Collection Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-medium">{formatCurrency(totalCollected + totalOutstanding)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="font-medium text-green-600">{formatCurrency(totalCollected)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-medium text-red-600">{formatCurrency(totalOutstanding)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Collection Rate</span><span className="font-medium">{totalCollected + totalOutstanding > 0 ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100) : 0}%</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Status Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3"><div className="h-2 flex-1 bg-green-500 rounded" style={{ width: `${paid.length}%` }} /><span>PAID: {paid.length}</span></div>
                <div className="flex items-center gap-3"><div className="h-2 flex-1 bg-gray-400 rounded" style={{ width: `${unpaid.filter(d => d.status === 'UNPAID').length}%` }} /><span>Unpaid: {unpaid.filter(d => d.status === 'UNPAID').length}</span></div>
                <div className="flex items-center gap-3"><div className="h-2 flex-1 bg-blue-500 rounded" style={{ width: `${ready.length}%` }} /><span>Ready: {ready.length}</span></div>
                <div className="flex items-center gap-3"><div className="h-2 flex-1 bg-red-500 rounded" style={{ width: `${suspended.length}%` }} /><span>Suspended: {suspended.length}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Record payment dialog */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {recordDue && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Student:</span> {recordDue.student?.user?.fullName}</p>
                <p><span className="text-muted-foreground">Period:</span> {formatDate(recordDue.periodStart)} — {formatDate(recordDue.periodEnd)}</p>
              </div>
              <div className="space-y-2">
                <Label>Amount (LKR)</Label>
                <Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={payForm.paymentMethod} onValueChange={v => setPayForm({ ...payForm, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="Optional" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-3 text-xs text-blue-700 dark:text-blue-300">
                On confirm: this due is marked Paid, the student&apos;s attendance block is lifted, and a receipt email is sent.
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRecordOpen(false)}>Cancel</Button>
                <Button disabled={recording} onClick={handleRecord}>
                  {recording && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
