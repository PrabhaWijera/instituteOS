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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatDate } from '@/lib/utils';
import type { User } from '@/lib/types';
import logger from '@/lib/logger';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  INSTITUTE_ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  TEACHER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  STUDENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  PARENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

interface UserDetail extends User {
  isDeleted: boolean;
  updatedAt: string;
  institute?: { name: string };
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/users/${id}`).then(({ data }) => {
      setUser(data.data);
      setFullName(data.data.fullName);
      setEmail(data.data.email);
      setPhone(data.data.phone || '');
    }).catch((err) => { logger.error('Failed to load user', err); toast.error('User not found'); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/users/${id}`, { fullName, email, phone: phone || undefined });
      toast.success('User updated');
      setUser(prev => prev ? { ...prev, ...data.data } : prev);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  async function toggleActive() {
    if (!user) return;
    try {
      await api.patch(`/users/${id}/status`, { isActive: !user.isActive });
      setUser(prev => prev ? { ...prev, isActive: !prev.isActive } : prev);
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
    } catch { toast.error('Failed'); }
  }

  async function resendInvite() {
    try {
      await api.post(`/users/${id}/resend-invite`);
      toast.success('Invite resent');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      router.push('/users');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to deactivate');
    } finally { setDeleting(false); }
  }

  if (loading) return <DetailSkeleton />;
  if (!user) return <div className="p-8 text-center text-muted-foreground">User not found</div>;

  const isPending = !user.lastLoginAt && !user.isActive;
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <PageHeader title="User Detail" description={`Manage ${user.fullName}'s account`}>
        <Button variant="outline" onClick={() => router.push('/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Users
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Editable Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.profileImage} />
                <AvatarFallback className="text-lg">{getInitials(user.fullName)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{user.fullName}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isSuperAdmin} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSuperAdmin} />
                {!isSuperAdmin && (
                  <p className="text-xs text-amber-600">Changing email requires the user to re-verify their account.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isSuperAdmin} />
              </div>

              {!isSuperAdmin && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">Toggle user active status</p>
                  </div>
                  <Switch checked={user.isActive} onCheckedChange={toggleActive} />
                </div>
              )}

              {isPending && (
                <Button variant="outline" onClick={resendInvite}>
                  <Mail className="h-4 w-4 mr-2" />Resend Invite
                </Button>
              )}

              {!isSuperAdmin && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Read-only Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Role</Label>
              <div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[user.role] || ''}`}>
                  {user.role.replace('_', ' ')}
                </span>
                <p className="text-xs text-muted-foreground mt-1">Role is set by the system. Changing it would break database relationships.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Institute</Label>
              <Input value={user.institute?.name || '—'} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Institute assignment is permanent.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">User ID</Label>
              <Input value={user.id} disabled className="bg-muted font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Joined</Label>
              <Input value={formatDate(user.createdAt)} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Login</Label>
              <Input value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Password</Label>
              <Input value="Set by user" disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      {!isSuperAdmin && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive text-lg">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete account</p>
              <p className="text-sm text-muted-foreground">Soft-delete this user. They will be signed out and cannot log in. All records are preserved.</p>
            </div>
            <Button variant="destructive" disabled={user.isDeleted} onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />{user.isDeleted ? 'Already Deleted' : 'Delete User'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Delete Account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{user.fullName}</strong>&apos;s account? They will be signed out and cannot log in. All records are preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
