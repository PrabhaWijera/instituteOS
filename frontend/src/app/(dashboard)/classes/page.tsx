'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/layout/page-header';
import { CardGridSkeleton } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BookOpen, Plus, Loader2, Users, Eye, EyeOff, Trash2,
  ExternalLink, FileText, ClipboardCheck, UserMinus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import type { TuitionClass, User, Material } from '@/lib/types';
import logger from '@/lib/logger';

const SUBJECTS = [
  'Biology', 'Chemistry', 'Physics', 'Mathematics', 'History', 'Geography',
  'Commerce', 'Economics', 'English', 'Sinhala', 'Tamil', 'ICT', 'Combined Maths', 'Science',
];
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Grade 13 (O/L)', 'A/L'];
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DURATIONS = [
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
  { value: '120', label: '120 min' },
];

interface ClassDetail {
  id: string;
  name: string;
  subject: string;
  grade: string;
  feeAmount: number;
  startTime: string;
  durationMinutes: number;
  scheduleDays: string[];
  isActive: boolean;
  maxCapacity?: number;
  description?: string;
  teacher?: { id: string; fullName: string; email?: string; profileImage?: string };
  enrollments?: Array<{
    id: string;
    subscriptionStatus: string;
    enrolledAt: string;
    student: { id: string; grade: string; user: { fullName: string; profileImage?: string; email: string } };
  }>;
  sessions?: Array<{ id: string; startedAt: string; endedAt?: string; status: string; _count?: { records: number } }>;
  _count?: { enrollments?: number };
}

export default function ClassesPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'INSTITUTE_ADMIN';
  const [classes, setClasses] = useState<TuitionClass[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'students' | 'materials' | 'sessions'>('students');
  const [materials, setMaterials] = useState<Material[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', subject: '', grade: '', feeAmount: '',
    startTime: '08:00', durationMinutes: '60', scheduleDays: [] as string[],
    teacherId: '', maxCapacity: '', description: '',
  });

  // Enroll dialog
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [availableStudents, setAvailableStudents] = useState<Array<{ id: string; user: { fullName: string } }>>([]);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => { fetchClasses(); }, []);

  async function fetchClasses() {
    try {
      const endpoint = user?.role === 'TEACHER' ? '/classes/my' : user?.role === 'STUDENT' ? '/classes' : '/classes';
      const requests: Promise<any>[] = [api.get(endpoint)];
      if (isAdmin) requests.push(api.get('/users/faculty'));
      const results = await Promise.all(requests);
      setClasses(results[0].data.data || []);
      if (isAdmin) setTeachers(results[1].data.data || []);
    } catch (err) { logger.error('Failed to load classes', err); } finally { setLoading(false); }
  }

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailTab('students');
    try {
      const [cls, mats] = await Promise.all([
        api.get(`/classes/${id}`),
        api.get(`/materials/class/${id}`).catch(() => ({ data: { data: [] } })),
      ]);
      setDetail(cls.data.data);
      setMaterials(mats.data.data || []);
    } catch (err) { logger.error('Failed to load class detail', err); }
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/classes', {
        name: form.name, subject: form.subject, grade: form.grade,
        feeAmount: parseFloat(form.feeAmount), startTime: form.startTime,
        durationMinutes: parseInt(form.durationMinutes),
        scheduleDays: form.scheduleDays, teacherId: form.teacherId || undefined,
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : undefined,
        description: form.description || undefined,
      });
      toast.success('Class created');
      setCreateOpen(false);
      setForm({ name: '', subject: '', grade: '', feeAmount: '', startTime: '08:00', durationMinutes: '60', scheduleDays: [], teacherId: '', maxCapacity: '', description: '' });
      fetchClasses();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setCreating(false); }
  }

  function toggleDay(day: string) {
    setForm(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day) ? prev.scheduleDays.filter(d => d !== day) : [...prev.scheduleDays, day],
    }));
  }

  async function openEnroll() {
    if (!detail) return;
    try {
      const { data } = await api.get('/students');
      const enrolled = new Set(detail.enrollments?.map(e => e.student.id) || []);
      setAvailableStudents((data.data || []).filter((s: any) => !enrolled.has(s.id) && s.verificationStatus === 'VERIFIED'));
      setEnrollOpen(true);
    } catch { toast.error('Failed to load students'); }
  }

  async function handleEnroll() {
    if (!enrollStudentId || !selectedId) return;
    setEnrolling(true);
    try {
      await api.post('/enrollments', { studentId: enrollStudentId, classId: selectedId });
      toast.success('Student enrolled');
      setEnrollOpen(false);
      setEnrollStudentId('');
      loadDetail(selectedId);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setEnrolling(false); }
  }

  async function unenroll(enrollmentId: string) {
    try {
      await api.delete(`/enrollments/${enrollmentId}`);
      toast.success('Student unenrolled');
      if (selectedId) loadDetail(selectedId);
    } catch { toast.error('Failed'); }
  }

  async function toggleMaterialVisibility(id: string) {
    try {
      await api.patch(`/materials/${id}/visibility`);
      if (selectedId) {
        const { data } = await api.get(`/materials/class/${selectedId}`).catch(() => ({ data: { data: [] } }));
        setMaterials(data.data || []);
      }
    } catch { toast.error('Failed'); }
  }

  async function deleteMaterial(id: string) {
    try {
      await api.delete(`/materials/${id}`);
      toast.success('Material deleted');
      if (selectedId) {
        const { data } = await api.get(`/materials/class/${selectedId}`).catch(() => ({ data: { data: [] } }));
        setMaterials(data.data || []);
      }
    } catch { toast.error('Failed'); }
  }

  if (loading) return <CardGridSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Classes" description="Manage tuition classes">
        {isAdmin && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Class</Button>}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Class cards */}
        <div className="space-y-3">
          {classes.length === 0 && <EmptyState title="No classes" description="Create your first class" icon={BookOpen} />}
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className={`cursor-pointer transition-colors ${selectedId === cls.id ? 'border-primary ring-1 ring-primary' : ''}`}
              onClick={() => loadDetail(cls.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  <Badge variant={cls.isActive ? 'success' : 'secondary'}>{cls.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-xs">{cls.subject}</Badge>
                  <Badge variant="secondary" className="text-xs">{cls.grade}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Fee: {formatCurrency(cls.feeAmount)}</p>
                <p className="text-xs text-muted-foreground">{cls.scheduleDays?.join(', ')} at {cls.startTime}</p>
                <p className="text-xs text-muted-foreground">{cls._count?.enrollments || 0} students</p>
              </CardContent>
            </Card>
          ))}
          {isAdmin && (
            <Card className="cursor-pointer border-dashed hover:border-primary transition-colors" onClick={() => setCreateOpen(true)}>
              <CardContent className="flex flex-col items-center justify-center p-6 text-muted-foreground">
                <Plus className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium">Create new class</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Class detail */}
        <div className="lg:col-span-2">
          {!detail ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">Select a class to view details</CardContent></Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{detail.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {detail.subject} &middot; {detail.grade} &middot; {detail.teacher?.fullName || 'No teacher'} &middot; {formatCurrency(detail.feeAmount)}/mo
                    </p>
                  </div>
                  <Badge variant={detail.isActive ? 'success' : 'secondary'}>{detail.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 border-b mt-4">
                  {(['students', 'materials', 'sessions'] as const).map(t => (
                    <button key={t} onClick={() => setDetailTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${detailTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                      {t === 'students' && <Users className="h-3.5 w-3.5 inline mr-1.5" />}
                      {t === 'materials' && <FileText className="h-3.5 w-3.5 inline mr-1.5" />}
                      {t === 'sessions' && <ClipboardCheck className="h-3.5 w-3.5 inline mr-1.5" />}
                      {t}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {/* Students tab */}
                {detailTab === 'students' && (
                  <div className="space-y-4">
                    {isAdmin && (
                      <div className="flex justify-end">
                        <Button size="sm" onClick={openEnroll}><Plus className="h-3.5 w-3.5 mr-1" />Enroll Student</Button>
                      </div>
                    )}
                    {(!detail.enrollments || detail.enrollments.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No students enrolled yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Fee Status</TableHead>
                            <TableHead>Enrolled</TableHead>
                            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.enrollments.map(e => (
                            <TableRow key={e.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{getInitials(e.student.user.fullName)}</AvatarFallback></Avatar>
                                  <div>
                                    <p className="text-sm font-medium">{e.student.user.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{e.student.grade}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={e.subscriptionStatus === 'ACTIVE' ? 'success' : e.subscriptionStatus === 'PAYMENT_DUE' ? 'warning' : 'destructive'} className="text-xs">
                                  {e.subscriptionStatus.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatDate(e.enrolledAt)}</TableCell>
                              {isAdmin && (
                                <TableCell className="text-right">
                                  <Button size="icon" variant="ghost" className="text-destructive" title="Unenroll" onClick={() => unenroll(e.id)}>
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* Materials tab */}
                {detailTab === 'materials' && (
                  <div className="space-y-3">
                    {materials.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No materials uploaded.</p>
                    ) : (
                      materials.map(mat => (
                        <div key={mat.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{mat.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant={mat.type === 'PDF' ? 'destructive' : 'default'} className="text-[10px]">{mat.type === 'PDF' ? 'PDF' : 'Video'}</Badge>
                                <span className="text-xs text-muted-foreground">{mat.isVisible ? 'Visible' : 'Hidden'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" asChild><a href={mat.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                            {(isAdmin || user?.role === 'TEACHER') && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => toggleMaterialVisibility(mat.id)}>{mat.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMaterial(mat.id)}><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Sessions tab */}
                {detailTab === 'sessions' && (
                  <div className="space-y-3">
                    {(!detail.sessions || detail.sessions.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No sessions recorded.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead>Present</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.sessions.map(s => (
                            <TableRow key={s.id}>
                              <TableCell className="text-sm">{formatDate(s.startedAt)}</TableCell>
                              <TableCell className="text-sm">{new Date(s.startedAt).toLocaleTimeString()}</TableCell>
                              <TableCell className="text-sm">{s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : '—'}</TableCell>
                              <TableCell className="text-sm">{s._count?.records ?? 0}</TableCell>
                              <TableCell>
                                <Badge variant={s.status === 'ONGOING' ? 'default' : 'secondary'} className="text-xs">{s.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create class dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Class</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input placeholder="e.g. Grade 10 Biology — Morning" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Select value={form.subject} onValueChange={v => setForm({ ...form, subject: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grade *</Label>
                <Select value={form.grade} onValueChange={v => setForm({ ...form, grade: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teacher *</Label>
              <Select value={form.teacherId} onValueChange={v => setForm({ ...form, teacherId: v })}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Schedule Days *</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <Button key={d} type="button" size="sm" variant={form.scheduleDays.includes(d) ? 'default' : 'outline'} onClick={() => toggleDay(d)}>
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Duration *</Label>
                <Select value={form.durationMinutes} onValueChange={v => setForm({ ...form, durationMinutes: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Fee (LKR) *</Label>
                <Input type="number" placeholder="2500" value={form.feeAmount} onChange={e => setForm({ ...form, feeAmount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Max Capacity</Label>
                <Input type="number" placeholder="Unlimited" value={form.maxCapacity} onChange={e => setForm({ ...form, maxCapacity: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Optional description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Class
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enroll student dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll Student</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={enrollStudentId} onValueChange={setEnrollStudentId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {availableStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.user.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
              <Button disabled={!enrollStudentId || enrolling} onClick={handleEnroll}>
                {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enroll
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
