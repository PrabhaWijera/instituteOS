'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/layout/page-header';
import { CardGridSkeleton } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Plus, Loader2, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import type { Material, TuitionClass } from '@/lib/types';
import logger from '@/lib/logger';

function getPlatform(url: string): { label: string; color: string; bg: string; darkBg: string } {
  if (/zoom\.us/i.test(url))               return { label: 'Zoom',         color: '#2D8CFF', bg: 'bg-blue-50 dark:bg-blue-950/30',   darkBg: '#1d4ed8' };
  if (/meet\.google\.com/i.test(url))      return { label: 'Google Meet',  color: '#00897B', bg: 'bg-teal-50 dark:bg-teal-950/30',   darkBg: '#0f766e' };
  if (/teams\.(microsoft|live)\.com/i.test(url)) return { label: 'MS Teams', color: '#6264A7', bg: 'bg-indigo-50 dark:bg-indigo-950/30', darkBg: '#4338ca' };
  return { label: 'Live Session', color: '#E53935', bg: 'bg-red-50 dark:bg-red-950/30', darkBg: '#b91c1c' };
}

export default function LiveSessionsPage() {
  const user = useAuthStore((s) => s.user);
  const [sessions, setSessions] = useState<Material[]>([]);
  const [classes, setClasses] = useState<TuitionClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', classId: '', url: '' });

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'INSTITUTE_ADMIN';

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const clsRes = await api.get(isTeacher ? '/classes/my' : '/classes');
      const classList: TuitionClass[] = clsRes.data.data || [];
      setClasses(classList);
      const allMats = await Promise.all(
        classList.map((c) => api.get(`/materials/class/${c.id}`).catch(() => ({ data: { data: [] } })))
      );
      const liveMats = allMats
        .flatMap((r) => r.data.data || [])
        .filter((m: Material) => m.type === 'LIVE_LINK');
      setSessions(liveMats);
    } catch (err) {
      logger.error('Failed to load live sessions', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let url = form.url.trim();
      if (url && !url.match(/^https?:\/\//)) url = 'https://' + url;
      await api.post(`/materials/class/${form.classId}`, { title: form.title, type: 'LIVE_LINK', url });
      toast.success('Live session link added');
      setDialogOpen(false);
      setForm({ title: '', classId: '', url: '' });
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to add link');
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(id: string) {
    try {
      await api.patch(`/materials/${id}/visibility`);
      fetchData();
    } catch { toast.error('Failed'); }
  }

  async function deleteSession(id: string) {
    try {
      await api.delete(`/materials/${id}`);
      toast.success('Removed');
      fetchData();
    } catch { toast.error('Failed'); }
  }

  if (loading) return <CardGridSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Sessions"
        description={isTeacher ? 'Share live class links with your students' : 'Join your scheduled live classes'}
      >
        {isTeacher && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setForm({ title: '', classId: '', url: '' }); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Live Link</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Live Session Link</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Session Title</Label>
                  <Input
                    placeholder="e.g. Today's Math Class"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Meeting Link</Label>
                  <Input
                    placeholder="https://zoom.us/j/... or meet.google.com/..."
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Supports Zoom, Google Meet, Microsoft Teams, or any URL</p>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving || !form.classId}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Link
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      {sessions.length === 0 ? (
        <EmptyState
          title="No live sessions"
          description={isTeacher ? 'Add a Zoom, Google Meet, or Teams link for your students' : 'No live sessions have been shared yet'}
          icon={Video}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const platform = getPlatform(session.url);
            return (
              <Card key={session.id} className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
                {/* Colour header strip */}
                <div className="h-1.5 w-full" style={{ background: platform.color }} />
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 rounded-xl items-center justify-center ${platform.bg}`}>
                        <Video className="h-5 w-5" style={{ color: platform.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{session.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{session.class?.name}</p>
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: platform.color, background: `${platform.color}18` }}
                    >
                      {platform.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(session.createdAt)}</span>
                    <Badge variant={session.isVisible ? 'success' : 'secondary'} className="text-[10px]">
                      {session.isVisible ? 'Visible' : 'Hidden'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      className="flex-1 font-semibold"
                      style={{ background: platform.color, color: '#fff' }}
                    >
                      <a href={session.url.startsWith('http') ? session.url : `https://${session.url}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Join Now
                      </a>
                    </Button>
                    {isTeacher && (
                      <>
                        <Button size="icon" variant="outline" onClick={() => toggleVisibility(session.id)} title={session.isVisible ? 'Hide' : 'Show'}>
                          {session.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteSession(session.id)} title="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
