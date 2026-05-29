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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Building2, Plus, Search, Loader2, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import type { Institute } from '@/lib/types';
import logger from '@/lib/logger';

const emptyForm = { name: '', code: '', address: '', city: '', phone: '', subscriptionPlan: 'FREE', adminName: '', adminEmail: '', adminPhone: '' };

export default function InstitutesPage() {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', address: '', city: '', phone: '' });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Institute | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchInstitutes(); }, []);

  async function fetchInstitutes() {
    try {
      const { data } = await api.get('/institutes');
      setInstitutes(data.data);
    } catch (err) { logger.error('Failed to load institutes', err); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/institutes', form);
      toast.success('Institute created & invite sent');
      setDialogOpen(false);
      setForm({ ...emptyForm });
      fetchInstitutes();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to create');
    } finally { setCreating(false); }
  }

  async function toggleStatus(id: string, currentActive: boolean) {
    setInstitutes(prev => prev.map(i => i.id === id ? { ...i, isActive: !currentActive } : i));
    try {
      await api.patch(`/institutes/${id}/status`, { isActive: !currentActive });
    } catch (err) {
      setInstitutes(prev => prev.map(i => i.id === id ? { ...i, isActive: currentActive } : i));
      logger.error('Toggle status failed', err);
      toast.error('Failed to update status');
    }
  }

  function openEdit(inst: Institute) {
    setEditId(inst.id);
    setEditForm({ name: inst.name, address: inst.address, city: inst.city, phone: inst.phone });
    setEditDialogOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/institutes/${editId}`, editForm);
      toast.success('Institute updated');
      setEditDialogOpen(false);
      fetchInstitutes();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  function openDelete(inst: Institute) {
    setDeleteTarget(inst);
    setDeleteConfirmName('');
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/institutes/${deleteTarget.id}`);
      toast.success('Institute deleted');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setInstitutes(prev => prev.filter(i => i.id !== deleteTarget!.id));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  }

  const filtered = institutes.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? i.isActive : !i.isActive);
    return matchSearch && matchStatus;
  });

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Institutes" description="Manage all registered institutes">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Institute</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Institute & Send Admin Invite</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Institute Name</Label>
                  <Input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); if (!form.code) { const auto = e.target.value.replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,7) + '01'; setForm(f => ({ ...f, code: auto })); }}} placeholder="Sunrise Academy" required />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUNRISE01" pattern="^[A-Z0-9]{3,10}$" title="3-10 uppercase letters/numbers" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 MG Road, Koramangala" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bangalore" required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subscription Plan</Label>
                <Select value={form.subscriptionPlan} onValueChange={(v) => setForm({ ...form, subscriptionPlan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">FREE</SelectItem>
                    <SelectItem value="BASIC">BASIC</SelectItem>
                    <SelectItem value="PRO">PRO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Institute Admin</p>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-700 dark:text-blue-300 mb-3">
                  An invite email will be sent to the admin email. The link expires in 48 hours.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Admin Name</Label>
                  <Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="Rahul Sharma" required />
                </div>
                <div className="space-y-2">
                  <Label>Admin Email</Label>
                  <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="rahul@sunrise.edu" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Admin Phone (optional)</Label>
                <Input value={form.adminPhone} onChange={(e) => setForm({ ...form, adminPhone: e.target.value })} placeholder="9876543211" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Institute & Send Invite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No institutes" description="Create your first institute to get started" icon={Building2} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institute</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-center">Teachers</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">{inst.code}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(inst as any).admin?.fullName || '—'}</TableCell>
                  <TableCell className="text-sm">{inst.city}</TableCell>
                  <TableCell className="text-center text-sm">{inst.teacherCount ?? 0}</TableCell>
                  <TableCell className="text-center text-sm">{inst.studentCount ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={inst.isActive} onCheckedChange={() => toggleStatus(inst.id, inst.isActive)} />
                      <Badge variant={inst.isActive ? 'success' : 'destructive'} className="text-xs">
                        {inst.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inst.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" asChild title="View detail">
                        <Link href={`/institutes/${inst.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(inst)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => openDelete(inst)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Institute</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Delete Institute</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete <strong>{deleteTarget?.name}</strong> and ALL its data including students, teachers, classes, attendance records, and payments. This cannot be undone.
            </p>
            <div className="space-y-2">
              <Label>Type the institute name to confirm:</Label>
              <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} placeholder={deleteTarget?.name} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteConfirmName !== deleteTarget?.name || deleting} onClick={handleDelete}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete Permanently
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
