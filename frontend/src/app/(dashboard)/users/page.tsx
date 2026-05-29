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
import { Users, Search, Eye, Ban, ShieldCheck, Mail, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatDate } from '@/lib/utils';
import type { User, Institute, Role } from '@/lib/types';
import logger from '@/lib/logger';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  INSTITUTE_ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  TEACHER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  STUDENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  PARENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

type Tab = 'ALL' | Role;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('ALL');
  const [instituteFilter, setInstituteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/users?limit=100'),
      api.get('/institutes'),
    ]).then(([usersRes, instRes]) => {
      setUsers(usersRes.data.data?.data || usersRes.data.data || []);
      setInstitutes(instRes.data.data || []);
    }).catch((err) => logger.error('Failed to load data', err)).finally(() => setLoading(false));
  }, []);

  async function toggleUserStatus(userId: string, currentActive: boolean) {
    try {
      await api.patch(`/users/${userId}/status`, { isActive: !currentActive });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentActive } : u));
      toast.success(currentActive ? 'User deactivated' : 'User activated');
    } catch (err) { logger.error('Toggle status failed', err); toast.error('Failed'); }
  }

  async function resendInvite(userId: string) {
    try {
      await api.post(`/users/${userId}/resend-invite`);
      toast.success('Invite resent');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to resend');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success('User deleted');
      setUsers(prev => prev.filter(u => u.id !== deleteTarget!.id));
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  }

  function getUserStatus(u: User): 'active' | 'inactive' | 'pending' {
    if (!u.lastLoginAt && !u.isActive) return 'pending';
    return u.isActive ? 'active' : 'inactive';
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'INSTITUTE_ADMIN', label: 'Admins' },
    { key: 'TEACHER', label: 'Teachers' },
    { key: 'STUDENT', label: 'Students' },
    { key: 'PARENT', label: 'Parents' },
  ];

  const filtered = users.filter((u) => {
    if (tab !== 'ALL' && u.role !== tab) return false;
    if (instituteFilter !== 'all' && u.instituteId !== instituteFilter) return false;
    if (statusFilter !== 'all' && getUserStatus(u) !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    }
    return true;
  });

  const tabCounts = tabs.map(t => ({
    ...t,
    count: users.filter(u => t.key === 'ALL' || u.role === t.key).length,
  }));

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="All Users" description="Every user on the platform" />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabCounts.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label} <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={instituteFilter} onValueChange={setInstituteFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All institutes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All institutes</SelectItem>
            {institutes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Invite pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No users found" icon={Users} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Institute</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const status = getUserStatus(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.profileImage} />
                          <AvatarFallback className="text-xs">{getInitials(u.fullName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{u.fullName}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] || ''}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(u as any).institute?.name || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${
                          status === 'active' ? 'bg-green-500' : status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        <span className="text-sm capitalize">{status === 'pending' ? 'Invite pending' : status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild title="View detail">
                          <Link href={`/users/${u.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        {u.role !== 'SUPER_ADMIN' && u.isActive && (
                          <Button size="icon" variant="ghost" title="Deactivate" onClick={() => toggleUserStatus(u.id, true)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {u.role !== 'SUPER_ADMIN' && !u.isActive && u.lastLoginAt && (
                          <Button size="icon" variant="ghost" title="Activate" onClick={() => toggleUserStatus(u.id, false)}>
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {status === 'pending' && (
                          <Button size="icon" variant="ghost" title="Resend invite" onClick={() => resendInvite(u.id)}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {u.role !== 'SUPER_ADMIN' && (
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" title="Delete"
                            onClick={() => { setDeleteTarget(u); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteTarget?.fullName}</strong>&apos;s account? They will be signed out and cannot log in. All records are preserved and this action can be reviewed by a super admin.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
