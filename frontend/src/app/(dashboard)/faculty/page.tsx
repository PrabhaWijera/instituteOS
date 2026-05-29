'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus, Loader2, Mail, X, Pencil, Ban, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials } from '@/lib/utils';
import type { User } from '@/lib/types';
import logger from '@/lib/logger';

interface TeacherInfo extends User {
  teacherClasses?: Array<{ id: string; name: string; subject: string; grade: string }>;
  _count?: { classes?: number; sessions?: number };
  invite?: { id: string; expiresAt: string; usedAt?: string | null };
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<TeacherInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<TeacherInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchFaculty(); }, []);

  async function fetchFaculty() {
    try {
      const { data } = await api.get('/users/faculty');
      setFaculty(data.data || []);
    } catch (err) { logger.error('Failed to load faculty', err); } finally { setLoading(false); }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/users/faculty/invite', { fullName: form.fullName, email: form.email, phone: form.phone || undefined });
      toast.success(`Invite sent to ${form.email}`);
      setDialogOpen(false);
      setForm({ fullName: '', email: '', phone: '' });
      fetchFaculty();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to send invite');
    } finally { setInviting(false); }
  }

  async function resendInvite(userId: string) {
    try {
      await api.post(`/users/${userId}/resend-invite`);
      toast.success('Invite resent');
    } catch { toast.error('Failed to resend invite'); }
  }

  async function toggleTeacherStatus(userId: string, currentlyActive: boolean) {
    try {
      await api.patch(`/users/faculty/${userId}/status`);
      toast.success(currentlyActive ? 'Teacher deactivated' : 'Teacher reactivated');
      setFaculty(prev => prev.map(t => t.id === userId ? { ...t, isActive: !currentlyActive } : t));
    } catch { toast.error('Failed to update teacher status'); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/faculty/${deleteTarget.id}`);
      toast.success(`${deleteTarget.fullName} removed`);
      setFaculty(prev => prev.filter(t => t.id !== deleteTarget!.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete teacher');
    } finally { setDeleting(false); }
  }

  const isPending = (t: TeacherInfo) => t.invite && !t.invite.usedAt && !t.lastLoginAt;

  if (loading) return <Loading />;

  const active = faculty.filter(t => !isPending(t));
  const pending = faculty.filter(t => isPending(t));

  return (
    <div className="space-y-6">
      <PageHeader title="Teachers" description="Manage teaching faculty">
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Invite Teacher</Button>
      </PageHeader>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Pending Invites</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pending.map(t => {
              const expires = t.invite ? new Date(t.invite.expiresAt) : null;
              const hoursLeft = expires ? Math.max(0, Math.round((expires.getTime() - Date.now()) / 3600000)) : 0;
              return (
                <Card key={t.id} className="border-l-4 border-l-amber-400">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10"><AvatarFallback>{getInitials(t.fullName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                      </div>
                      <Badge variant="warning" className="text-xs">Invite Pending</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Expires in {hoursLeft}h</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => resendInvite(t.id)}><Mail className="h-3 w-3 mr-1" />Resend</Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget(t)}><Trash2 className="h-3 w-3 mr-1" />Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Active teachers */}
      {active.length === 0 && pending.length === 0 ? (
        <EmptyState title="No teachers" description="Invite teachers to your institute" icon={Users} />
      ) : active.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {active.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={t.profileImage} />
                    <AvatarFallback>{getInitials(t.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                  </div>
                  <Badge variant={t.isActive ? 'success' : 'secondary'} className="text-xs">
                    {t.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.teacherClasses?.length ?? 0} classes assigned
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" asChild><Link href={`/faculty/${t.id}`}><Pencil className="h-3 w-3 mr-1" />Edit</Link></Button>
                  <Button
                    size="sm" variant="outline"
                    className={t.isActive ? 'text-amber-600' : 'text-green-600'}
                    onClick={() => toggleTeacherStatus(t.id, t.isActive)}
                  >
                    {t.isActive
                      ? <Ban className="h-3 w-3 mr-1" />
                      : <ShieldCheck className="h-3 w-3 mr-1" />}
                    {t.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="h-3 w-3 mr-1" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Remove Teacher</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.fullName}</strong> from your institute? They will be signed out immediately
            and their email will be freed so you can re-invite them later. All class and attendance records are preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Teacher</DialogTitle></DialogHeader>
          <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-3 text-sm text-blue-700 dark:text-blue-300">
            An invite email will be sent immediately. The teacher creates their own password via the link. The link expires in 48 hours.
          </div>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="John Doe" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" placeholder="teacher@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Phone</Label><Input placeholder="Optional" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
