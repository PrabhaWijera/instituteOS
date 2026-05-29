'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { DetailSkeleton } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ShieldCheck, Ban, Plus, UserMinus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import logger from '@/lib/logger';

interface StudentDetail {
  id: string;
  grade: string;
  verificationStatus: string;
  dob?: string;
  gender?: string;
  address?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  createdAt: string;
  user: { id: string; fullName: string; email: string; phone?: string; profileImage?: string; isActive: boolean; lastLoginAt?: string };
  enrollments?: Array<{
    id: string;
    subscriptionStatus: string;
    enrolledAt: string;
    class: { id: string; name: string; subject: string; grade: string; feeAmount: number; scheduleDays: string[]; startTime: string };
  }>;
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; subject: string }>>([]);
  const [enrollClassId, setEnrollClassId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    grade: '', gender: '', dob: '', address: '',
    parentName: '', parentEmail: '', parentPhone: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchStudent(); }, [id]);

  async function fetchStudent() {
    try {
      const { data } = await api.get(`/students/${id}`);
      const s = data.data;
      setStudent(s);
      setEditForm({
        grade: s.grade || '',
        gender: s.gender || '',
        dob: s.dob ? s.dob.slice(0, 10) : '',
        address: s.address || '',
        parentName: s.parentName || '',
        parentEmail: s.parentEmail || '',
        parentPhone: s.parentPhone || '',
      });
    } catch (err) { logger.error('Failed to load student', err); } finally { setLoading(false); }
  }

  async function saveStudentDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/students/${id}`, {
        grade: editForm.grade || undefined,
        gender: editForm.gender || undefined,
        dob: editForm.dob ? new Date(`${editForm.dob}T00:00:00.000Z`).toISOString() : undefined,
        address: editForm.address || undefined,
        parentName: editForm.parentName || undefined,
        parentEmail: editForm.parentEmail || undefined,
        parentPhone: editForm.parentPhone || undefined,
      });
      toast.success('Student details updated');
      setEditOpen(false);
      fetchStudent();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  async function verifyStudent() {
    try {
      await api.patch(`/students/${id}/verify`);
      toast.success('Student verified');
      setVerified(true);
      fetchStudent();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    }
  }

  async function toggleStudentStatus() {
    const currentlyActive = student?.user?.isActive ?? true;
    try {
      await api.patch(`/students/${id}/status`);
      toast.success(currentlyActive ? 'Student deactivated' : 'Student reactivated');
      setStudent(prev => prev ? { ...prev, user: { ...prev.user, isActive: !currentlyActive } } : prev);
    } catch { toast.error('Failed to update student status'); }
  }

  async function handleHardDelete() {
    setHardDeleting(true);
    try {
      await api.delete(`/students/${id}`);
      toast.success('Student removed');
      router.push('/students');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to remove student');
    } finally { setHardDeleting(false); }
  }

  async function openEnroll() {
    try {
      const { data } = await api.get('/classes');
      const enrolledIds = new Set(student?.enrollments?.map(e => e.class.id) || []);
      setClasses((data.data || []).filter((c: any) => !enrolledIds.has(c.id)));
      setEnrollOpen(true);
    } catch { toast.error('Failed to load classes'); }
  }

  async function handleEnroll() {
    if (!enrollClassId) return;
    setEnrolling(true);
    try {
      await api.post('/enrollments', { studentId: id, classId: enrollClassId });
      toast.success('Enrolled');
      setEnrollOpen(false);
      setEnrollClassId('');
      fetchStudent();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setEnrolling(false); }
  }

  async function unenroll(enrollmentId: string) {
    try {
      await api.delete(`/enrollments/${enrollmentId}`);
      toast.success('Unenrolled');
      fetchStudent();
    } catch { toast.error('Failed'); }
  }

  if (loading) return <DetailSkeleton />;
  if (!student) return <p className="p-6 text-muted-foreground">Student not found.</p>;

  const s = student;
  const vs = s.verificationStatus;

  return (
    <div className="space-y-6">
      <PageHeader title={s.user.fullName} description={`Grade ${s.grade}`}>
        <Button variant="outline" asChild><Link href="/students"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column - profile & verification */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={s.user.profileImage} />
                    <AvatarFallback className="text-lg">{getInitials(s.user.fullName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{s.user.fullName}</CardTitle>
                    <Badge className="mt-1" variant={vs === 'VERIFIED' ? 'success' : vs === 'PENDING_VERIFICATION' ? 'warning' : 'secondary'}>
                      {vs.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
                {vs !== 'VERIFIED' && (
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Email:</span> {s.user.email}</div>
                <div><span className="text-muted-foreground">Phone:</span> {s.user.phone || '—'}</div>
                <div><span className="text-muted-foreground">DOB:</span> {s.dob ? formatDate(s.dob) : '—'}</div>
                <div><span className="text-muted-foreground">Gender:</span> {s.gender || '—'}</div>
              </div>
              <div><span className="text-muted-foreground">Address:</span> {s.address || '—'}</div>
            </CardContent>
          </Card>

          {/* Parent info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Parent Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Name:</span> {s.parentName || '—'}</div>
              <div><span className="text-muted-foreground">Email:</span> {s.parentEmail || '—'}</div>
              <div><span className="text-muted-foreground">Phone:</span> {s.parentPhone || '—'}</div>
            </CardContent>
          </Card>

          {/* Verification action box */}
          {vs === 'PENDING_PROFILE' && (
            <Card className="border-gray-300">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Student has not yet completed their profile. They must log in and fill their details before you can verify.
              </CardContent>
            </Card>
          )}
          {vs === 'PENDING_VERIFICATION' && (
            <Card className="border-green-300 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-green-700 dark:text-green-300">Student has submitted their profile and is awaiting your verification.</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="rounded" />
                  I have verified this student&apos;s identity in person.
                </label>
                <Button size="sm" disabled={!verified} onClick={verifyStudent}>
                  <ShieldCheck className="h-4 w-4 mr-2" />Verify Student
                </Button>
              </CardContent>
            </Card>
          )}
          {vs === 'VERIFIED' && (
            <Card className="border-green-300 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <ShieldCheck className="h-5 w-5" /> Verified — Profile is permanently locked.
              </CardContent>
            </Card>
          )}

          {/* Danger zone */}
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-wrap gap-2">
              <Button
                variant={student?.user?.isActive ? 'outline' : 'default'}
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className={student?.user?.isActive
                  ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                  : 'bg-green-600 hover:bg-green-700 text-white'}
              >
                <Ban className="h-4 w-4 mr-2" />
                {student?.user?.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setHardDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />Remove Student
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column - enrollments */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Enrolled Classes</CardTitle>
              <Button size="sm" onClick={openEnroll}><Plus className="h-3.5 w-3.5 mr-1" />Enroll</Button>
            </CardHeader>
            <CardContent>
              {(!s.enrollments || s.enrollments.length === 0) ? (
                <p className="text-sm text-muted-foreground">Not enrolled in any class.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.enrollments.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{e.class.name}</p>
                          <p className="text-xs text-muted-foreground">{e.class.subject} · {e.class.scheduleDays?.join(', ')}</p>
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(e.class.feeAmount)}/mo</TableCell>
                        <TableCell>
                          <Badge variant={e.subscriptionStatus === 'ACTIVE' ? 'success' : e.subscriptionStatus === 'PAYMENT_DUE' ? 'warning' : 'destructive'} className="text-xs">
                            {e.subscriptionStatus.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => unenroll(e.id)} title="Unenroll">
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deactivate/Reactivate confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{student?.user?.isActive ? 'Deactivate Student' : 'Reactivate Student'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {student?.user?.isActive
              ? 'Student will be blocked from logging in. All records are preserved and this can be reversed.'
              : 'Student will be able to log in again.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant={student?.user?.isActive ? 'outline' : 'default'}
              className={student?.user?.isActive ? 'border-amber-300 text-amber-600 hover:bg-amber-50' : 'bg-green-600 hover:bg-green-700 text-white'}
              onClick={() => { toggleStudentStatus(); setDeleteOpen(false); }}
            >
              {student?.user?.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove (soft-delete) confirm */}
      <Dialog open={hardDeleteOpen} onOpenChange={setHardDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove Student</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{student?.user?.fullName}</strong> from the institute? They will be signed out
            and their email freed for re-registration. All attendance and payment records are preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={hardDeleting} onClick={handleHardDelete}>
              {hardDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit student details dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Student Details</DialogTitle></DialogHeader>
          <form onSubmit={saveStudentDetails} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Grade</Label>
                <Input value={editForm.grade} onChange={e => setEditForm({ ...editForm, grade: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={v => setEditForm({ ...editForm, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input type="date" value={editForm.dob} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Parent Name</Label>
                <Input value={editForm.parentName} onChange={e => setEditForm({ ...editForm, parentName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Parent Email</Label>
                <Input type="email" value={editForm.parentEmail} onChange={e => setEditForm({ ...editForm, parentEmail: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Parent Phone</Label>
                <Input value={editForm.parentPhone} onChange={e => setEditForm({ ...editForm, parentPhone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll in Class</DialogTitle></DialogHeader>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No available classes. The student is already enrolled in all active classes, or no classes have been created yet.
            </p>
          ) : (
            <Select value={enrollClassId} onValueChange={setEnrollClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.subject}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            {classes.length > 0 && (
              <Button disabled={!enrollClassId || enrolling} onClick={handleEnroll}>
                {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enroll
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
