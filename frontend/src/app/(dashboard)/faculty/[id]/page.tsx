'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { DetailSkeleton } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Save, Loader2, Ban, CheckCircle, BookOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatDate } from '@/lib/utils';
import logger from '@/lib/logger';

interface TeacherDetail {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  profileImage?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  teacherClasses: Array<{
    id: string;
    name: string;
    subject: string;
    grade: string;
    scheduleDays: string[];
    startTime: string;
  }>;
  _count: { sessions: number };
}

export default function FacultyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/users/faculty/${id}`)
      .then(({ data }) => {
        const t = data.data;
        setTeacher(t);
        setForm({ fullName: t.fullName, phone: t.phone || '' });
      })
      .catch((err) => {
        logger.error('Failed to load teacher', err);
        toast.error('Teacher not found');
        router.push('/faculty');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/users/faculty/${id}`, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
      });
      toast.success('Teacher updated');
      setTeacher(prev => prev ? { ...prev, fullName: form.fullName, phone: form.phone } : prev);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  async function toggleStatus() {
    if (!teacher) return;
    const action = teacher.isActive ? 'deactivated' : 'reactivated';
    try {
      await api.patch(`/users/faculty/${id}/status`);
      toast.success(`Teacher ${action}`);
      setTeacher(prev => prev ? { ...prev, isActive: !prev.isActive } : prev);
    } catch { toast.error(`Failed to update status`); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/users/faculty/${id}`);
      toast.success('Teacher removed');
      router.push('/faculty');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete teacher');
    } finally { setDeleting(false); }
  }

  if (loading) return <DetailSkeleton />;
  if (!teacher) return null;

  return (
    <div className="space-y-6">
      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Remove Teacher</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{teacher.fullName}</strong> from your institute? They will be signed out immediately and
            their email will be freed so they can be re-invited later. All class and attendance records are preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PageHeader title="Teacher Details" description="View and edit teacher information">
        <Button variant="outline" onClick={() => router.push('/faculty')}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <Avatar className="h-20 w-20 mx-auto">
              <AvatarImage src={teacher.profileImage} />
              <AvatarFallback className="text-xl">{getInitials(teacher.fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{teacher.fullName}</h2>
              <p className="text-sm text-muted-foreground">{teacher.email}</p>
              {teacher.phone && <p className="text-sm text-muted-foreground">{teacher.phone}</p>}
            </div>
            <Badge variant={teacher.isActive ? 'success' : 'destructive'} className="text-xs">
              {teacher.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{teacher.teacherClasses.length}</p>
                <p className="text-xs text-muted-foreground">Classes</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{teacher._count.sessions}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground space-y-1 text-left">
              <p>Joined: {formatDate(teacher.createdAt)}</p>
              <p>Last login: {teacher.lastLoginAt ? formatDate(teacher.lastLoginAt) : 'Never'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Edit form + classes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit form */}
          <Card>
            <CardHeader><CardTitle className="text-base">Edit Information</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={teacher.email} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" className={teacher.isActive ? 'text-amber-600 border-amber-300' : 'text-green-600 border-green-300'} onClick={toggleStatus}>
                    {teacher.isActive ? <><Ban className="mr-1 h-4 w-4" />Deactivate</> : <><CheckCircle className="mr-1 h-4 w-4" />Reactivate</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader><CardTitle className="text-destructive text-base">Danger Zone</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Remove teacher</p>
                <p className="text-xs text-muted-foreground">Permanently removes this teacher from the institute. Their email is freed so they can be re-invited. All records are preserved.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" />Remove
              </Button>
            </CardContent>
          </Card>

          {/* Assigned classes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />Assigned Classes ({teacher.teacherClasses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teacher.teacherClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {teacher.teacherClasses.map(c => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.subject} &middot; Grade {c.grade} &middot; {c.scheduleDays?.join(', ')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{c.startTime}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
