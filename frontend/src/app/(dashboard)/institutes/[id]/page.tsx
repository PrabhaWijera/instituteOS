'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { DetailSkeleton } from '@/components/shared/loading';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Trash2, GraduationCap, Users, BookOpen, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatDate } from '@/lib/utils';
import logger from '@/lib/logger';

interface InstituteDetail {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  logoUrl: string | null;
  brandColor: string;
  subscriptionPlan: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  settings: Record<string, unknown> | null;
  admin: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  } | null;
  teacherCount: number;
  studentCount: number;
  classCount: number;
}

export default function InstituteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inst, setInst] = useState<InstituteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable form
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '' });

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/institutes/${id}`).then(({ data }) => {
      setInst(data.data);
      setForm({ name: data.data.name, address: data.data.address, city: data.data.city, phone: data.data.phone });
    }).catch((err) => { logger.error('Failed to load institute', err); toast.error('Institute not found'); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/institutes/${id}`, form);
      toast.success('Institute updated');
      setInst(prev => prev ? { ...prev, ...data.data } : prev);
      setEditing(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  async function toggleStatus() {
    if (!inst) return;
    try {
      await api.patch(`/institutes/${id}/status`, { isActive: !inst.isActive });
      setInst(prev => prev ? { ...prev, isActive: !prev.isActive } : prev);
      toast.success(inst.isActive ? 'Institute deactivated' : 'Institute activated');
    } catch { toast.error('Failed'); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/institutes/${id}`);
      toast.success('Institute deleted');
      router.push('/institutes');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  }

  async function resendAdminInvite() {
    if (!inst?.admin) return;
    try {
      await api.post(`/users/${inst.admin.id}/resend-invite`);
      toast.success('Invite resent to admin');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    }
  }

  if (loading) return <DetailSkeleton />;
  if (!inst) return <div className="p-8 text-center text-muted-foreground">Institute not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{inst.name}</h1>
            <Badge variant={inst.isActive ? 'success' : 'destructive'}>
              {inst.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-muted-foreground">{inst.code} &middot; {inst.city}</p>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); setForm({ name: inst.name, address: inst.address, city: inst.city, phone: inst.phone }); }}>Discard</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.push('/institutes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Students" value={inst.studentCount} icon={GraduationCap} />
        <StatCard title="Teachers" value={inst.teacherCount} icon={Users} />
        <StatCard title="Classes" value={inst.classCount} icon={BookOpen} />
        <StatCard title="Plan" value={inst.subscriptionPlan} icon={BookOpen} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Institute Info */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Institute Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              {editing ? (
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              ) : (
                <p className="text-sm">{inst.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={inst.code} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Code cannot be changed after students are enrolled.</p>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              {editing ? (
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              ) : (
                <p className="text-sm">{inst.address}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                {editing ? (
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                ) : (
                  <p className="text-sm">{inst.city}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                {editing ? (
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                ) : (
                  <p className="text-sm">{inst.phone}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground">{formatDate(inst.createdAt)}</p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">Toggle to activate or deactivate this institute</p>
              </div>
              <Switch checked={inst.isActive} onCheckedChange={toggleStatus} />
            </div>
          </CardContent>
        </Card>

        {/* Right: Admin Info */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Institute Admin</CardTitle></CardHeader>
          <CardContent>
            {inst.admin ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(inst.admin.fullName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{inst.admin.fullName}</p>
                    <p className="text-sm text-muted-foreground">{inst.admin.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{inst.admin.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={inst.admin.isActive ? 'success' : 'secondary'}>
                      {inst.admin.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Joined</span>
                    <span>{formatDate(inst.admin.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Login</span>
                    <span>{inst.admin.lastLoginAt ? formatDate(inst.admin.lastLoginAt) : 'Never'}</span>
                  </div>
                </div>
                {!inst.admin.lastLoginAt && (
                  <>
                    <Separator />
                    <Button variant="outline" onClick={resendAdminInvite} className="w-full">
                      <Mail className="h-4 w-4 mr-2" />Resend Invite
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No admin assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader><CardTitle className="text-destructive text-lg">Danger Zone</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Delete institute</p>
            <p className="text-sm text-muted-foreground">Permanently deletes this institute and all data. This action cannot be undone.</p>
          </div>
          <Button variant="destructive" onClick={() => { setDeleteConfirm(''); setDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 mr-2" />Delete
          </Button>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Delete Institute</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete <strong>{inst.name}</strong> and ALL its data including students, teachers, classes, attendance records, and payments. This cannot be undone.
            </p>
            <div className="space-y-2">
              <Label>Type the institute name to confirm:</Label>
              <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={inst.name} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteConfirm !== inst.name || deleting} onClick={handleDelete}>
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete Permanently
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
