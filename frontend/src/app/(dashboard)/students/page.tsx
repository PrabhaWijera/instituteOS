'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GraduationCap, Search, Plus, Eye, ShieldCheck, Ban, UserX, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatDate } from '@/lib/utils';
import type { StudentProfile, TuitionClass } from '@/lib/types';
import logger from '@/lib/logger';

const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Grade 13 (O/L)', 'A/L'];

type Tab = 'all' | 'verified' | 'pending_verify' | 'profile_pending' | 'fee_overdue';

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [classes, setClasses] = useState<TuitionClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<StudentProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Register form
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', grade: '',
    gender: '', dob: '', phone: '', address: '',
    parentName: '', parentEmail: '', parentPhone: '', classId: '',
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [sRes, cRes] = await Promise.all([api.get('/students'), api.get('/classes')]);
      setStudents(sRes.data.data || []);
      setClasses(cRes.data.data || []);
    } catch (err) { logger.error('Failed to load data', err); } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    try {
      await api.post('/students', {
        fullName: form.fullName, email: form.email, grade: form.grade,
        gender: form.gender || undefined, dob: form.dob ? new Date(form.dob).toISOString() : undefined,
        phone: form.phone || undefined, address: form.address || undefined,
        parentName: form.parentName || undefined, parentEmail: form.parentEmail || undefined,
        parentPhone: form.parentPhone || undefined, classId: form.classId || undefined,
      });
      toast.success('Student registered & invite sent');
      setRegisterOpen(false);
      setForm({ fullName: '', email: '', grade: '', gender: '', dob: '', phone: '', address: '', parentName: '', parentEmail: '', parentPhone: '', classId: '' });
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to register');
    } finally { setRegistering(false); }
  }

  async function verifyStudent(studentId: string) {
    try {
      await api.patch(`/students/${studentId}/verify`);
      toast.success('Student verified');
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    }
  }

  async function toggleStudentActive(studentId: string, currentlyActive: boolean) {
    try {
      await api.patch(`/students/${studentId}/status`);
      toast.success(currentlyActive ? 'Student deactivated' : 'Student reactivated');
      setStudents(prev => prev.map(s =>
        s.id === studentId ? { ...s, user: s.user ? { ...s.user, isActive: !currentlyActive } : s.user } : s
      ));
    } catch { toast.error('Failed to update student status'); }
  }

  async function handleDeleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteTarget.id}`);
      toast.success(`${deleteTarget.user?.fullName || 'Student'} removed`);
      setStudents(prev => prev.filter(s => s.id !== deleteTarget!.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete student');
    } finally { setDeleting(false); }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'verified', label: 'Verified' },
    { key: 'pending_verify', label: 'Pending Verify' },
    { key: 'profile_pending', label: 'Profile Pending' },
    { key: 'fee_overdue', label: 'Fee Overdue' },
  ];

  const filtered = students.filter(s => {
    if (tab === 'verified' && s.verificationStatus !== 'VERIFIED') return false;
    if (tab === 'pending_verify' && s.verificationStatus !== 'PENDING_VERIFICATION') return false;
    if (tab === 'profile_pending' && s.verificationStatus !== 'PENDING_PROFILE') return false;
    if (tab === 'fee_overdue' && !s.enrollments?.some((e: any) => ['PAYMENT_DUE', 'SUSPENDED'].includes(e.subscriptionStatus))) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.user?.fullName?.toLowerCase().includes(q) || s.user?.email?.toLowerCase().includes(q);
    }
    return true;
  });

  const tabCounts = tabs.map(t => ({
    ...t,
    count: t.key === 'all' ? students.length :
      t.key === 'verified' ? students.filter(s => s.verificationStatus === 'VERIFIED').length :
      t.key === 'pending_verify' ? students.filter(s => s.verificationStatus === 'PENDING_VERIFICATION').length :
      t.key === 'profile_pending' ? students.filter(s => s.verificationStatus === 'PENDING_PROFILE').length :
      students.filter(s => s.enrollments?.some((e: any) => ['PAYMENT_DUE', 'SUSPENDED'].includes(e.subscriptionStatus))).length,
  }));

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Manage institute students">
        <Button onClick={() => setRegisterOpen(true)}><Plus className="h-4 w-4 mr-2" />Register Student</Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabCounts.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label} <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No students" description="Register your first student" icon={GraduationCap} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Fee Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const feeStatus = s.enrollments?.some((e: any) => e.subscriptionStatus === 'SUSPENDED') ? 'SUSPENDED' :
                  s.enrollments?.some((e: any) => e.subscriptionStatus === 'PAYMENT_DUE') ? 'PAYMENT_DUE' : 'ACTIVE';
                return (
                  <TableRow key={s.id} className={feeStatus === 'SUSPENDED' ? 'bg-red-50/50 dark:bg-red-950/20' : feeStatus === 'PAYMENT_DUE' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={s.user?.profileImage} />
                          <AvatarFallback className="text-xs">{getInitials(s.user?.fullName || '?')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{s.user?.fullName}</p>
                          <p className="text-xs text-muted-foreground">{s.user?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{s.grade}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.enrollments?.length || 0} classes</TableCell>
                    <TableCell>
                      <Badge variant={s.verificationStatus === 'VERIFIED' ? 'success' : s.verificationStatus === 'PENDING_VERIFICATION' ? 'warning' : 'secondary'} className="text-xs">
                        {s.verificationStatus.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={feeStatus === 'ACTIVE' ? 'success' : feeStatus === 'PAYMENT_DUE' ? 'warning' : 'destructive'} className="text-xs">
                        {feeStatus.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.createdAt || '')}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild title="View">
                          <Link href={`/students/${s.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        {s.verificationStatus === 'PENDING_VERIFICATION' && (
                          <Button size="icon" variant="ghost" title="Verify" onClick={() => verifyStudent(s.id)}>
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          size="icon" variant="ghost"
                          title={s.user?.isActive ? 'Deactivate' : 'Reactivate'}
                          onClick={() => toggleStudentActive(s.id, s.user?.isActive ?? true)}
                          className={s.user?.isActive ? 'text-amber-500 hover:text-amber-600' : 'text-green-600 hover:text-green-700'}
                        >
                          {s.user?.isActive ? <UserX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          title="Delete student"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Student Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Remove Student</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.user?.fullName}</strong> from the institute? They will be signed out
            and their email will be freed so they can be re-registered later. All attendance and payment records are preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDeleteStudent}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Student Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Register Student</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Step 1 of 3 — Register student → Student completes profile → Admin verifies</p>
          <form onSubmit={handleRegister} className="space-y-4 mt-2">
            <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="John Doe" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Grade *</Label>
                <Select value={form.grade} onValueChange={v => setForm({ ...form, grade: v })}>
                  <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium">Parent Info (optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Parent Name</Label><Input value={form.parentName} onChange={e => setForm({ ...form, parentName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Parent Email</Label><Input type="email" value={form.parentEmail} onChange={e => setForm({ ...form, parentEmail: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Parent Phone</Label><Input value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })} /></div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label>Enroll in Class (optional)</Label>
              <Select value={form.classId} onValueChange={v => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Skip — enroll later" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.subject}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={registering}>
                {registering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Register & Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
