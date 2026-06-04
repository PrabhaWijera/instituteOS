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
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog';
import { normalizeMaterialUrl } from '@/lib/material-preview';
import { FileText, Plus, Loader2, ExternalLink, Eye, EyeOff, Trash2, Play, Video } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import type { Material, TuitionClass } from '@/lib/types';
import logger from '@/lib/logger';

function getLivePlatform(url: string): { label: string; color: string; bg: string } {
  if (/zoom\.us/i.test(url)) return { label: 'Zoom', color: '#2D8CFF', bg: '#EBF4FF' };
  if (/meet\.google\.com/i.test(url)) return { label: 'Google Meet', color: '#00897B', bg: '#E0F2F1' };
  if (/teams\.(microsoft|live)\.com/i.test(url)) return { label: 'MS Teams', color: '#6264A7', bg: '#EDECF8' };
  return { label: 'Live Session', color: '#E53935', bg: '#FFEBEE' };
}

export default function MaterialsPage() {
  const user = useAuthStore((s) => s.user);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [classes, setClasses] = useState<TuitionClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', classId: '', type: 'PDF' as string, url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Material | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const clsRes = await api.get(user?.role === 'TEACHER' ? '/classes/my' : '/classes');
      const classList = clsRes.data.data || [];
      setClasses(classList);
      const allMats = await Promise.all(
        classList.map((c: { id: string }) => api.get(`/materials/class/${c.id}`).catch(() => ({ data: { data: [] } })))
      );
      setMaterials(allMats.flatMap((r) => r.data.data || []));
    } catch (err) { logger.error('Failed to load materials', err); } finally { setLoading(false); }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    try {
      if (form.type === 'PDF' && file) {
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('classId', form.classId);
        formData.append('type', 'PDF');
        formData.append('file', file);
        await api.post(`/materials/class/${form.classId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        let url = form.url.trim();
        if (url && !url.match(/^https?:\/\//)) url = 'https://' + url;
        await api.post(`/materials/class/${form.classId}`, { title: form.title, type: form.type, url });
      }
      toast.success('Material uploaded — students can view it now');
      setDialogOpen(false);
      setForm({ title: '', classId: '', type: 'PDF', url: '' });
      setFile(null);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  }

  async function toggleVisibility(id: string) {
    try {
      await api.patch(`/materials/${id}/visibility`);
      toast.success('Visibility updated');
      fetchData();
    } catch (err) { logger.error('Toggle visibility failed', err); toast.error('Failed'); }
  }

  async function deleteMaterial(id: string) {
    try {
      await api.delete(`/materials/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch (err) { logger.error('Delete material failed', err); toast.error('Failed'); }
  }

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'INSTITUTE_ADMIN';
  const canManage = isTeacher;

  if (loading) return <CardGridSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Materials" description={canManage ? 'Class materials and resources' : 'Study materials for your classes'}>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm({ title: '', classId: '', type: 'PDF', url: '' }); setFile(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Material</DialogTitle></DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
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
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PDF">PDF Document</SelectItem>
                      <SelectItem value="VIDEO_LINK">Video Link (YouTube, etc.)</SelectItem>
                      <SelectItem value="LIVE_LINK">Live Session Link (Zoom / Meet / Teams)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.type === 'PDF' ? (
                  <div key="file-input" className="space-y-2">
                    <Label>File</Label>
                    <Input type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                  </div>
                ) : (
                  <div key="url-input" className="space-y-2">
                    <Label>{form.type === 'LIVE_LINK' ? 'Meeting Link' : 'Video URL'}</Label>
                    <Input
                      value={form.url}
                      onChange={(e) => {
                        let v = e.target.value;
                        if (v && !v.match(/^https?:\/\//)) v = 'https://' + v;
                        setForm({ ...form, url: v });
                      }}
                      placeholder={form.type === 'LIVE_LINK' ? 'https://zoom.us/j/...' : 'https://www.youtube.com/watch?v=...'}
                      required
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={uploading || !form.classId}>
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      {materials.length === 0 ? (
        <EmptyState
          title="No materials"
          description={canManage ? 'Upload study materials for your classes' : 'Your teacher has not shared materials yet'}
          icon={FileText}
        />
      ) : (
        <div className="space-y-3">
          {materials.map((mat) => {
            const platform = mat.type === 'LIVE_LINK' ? getLivePlatform(mat.url) : null;
            const openUrl = normalizeMaterialUrl(mat.url);
            return (
              <Card key={mat.id} className={mat.type === 'LIVE_LINK' ? 'border-l-4' : ''} style={mat.type === 'LIVE_LINK' ? { borderLeftColor: platform?.color } : {}}>
                <CardContent className="flex items-center justify-between p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {mat.type === 'LIVE_LINK' ? (
                      <div className="flex h-9 w-9 rounded-lg items-center justify-center shrink-0" style={{ background: platform?.bg }}>
                        <Video className="h-4 w-4" style={{ color: platform?.color }} />
                      </div>
                    ) : (
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{mat.title}</p>
                        {mat.type === 'LIVE_LINK' && platform && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: platform.color, background: platform.bg }}>{platform.label}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{mat.class?.name} &middot; {formatDate(mat.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && (
                      <Badge variant={mat.isVisible ? 'success' : 'secondary'}>
                        {mat.isVisible ? 'Visible' : 'Hidden'}
                      </Badge>
                    )}
                    {mat.type === 'LIVE_LINK' ? (
                      <Button size="sm" asChild style={{ background: platform?.color, color: '#fff' }}>
                        <a href={openUrl} target="_blank" rel="noopener noreferrer">Join</a>
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="default" onClick={() => setPreview(mat)}>
                          <Play className="h-3.5 w-3.5 mr-1" /> Preview
                        </Button>
                        <Button size="icon" variant="outline" asChild title="Open in new tab">
                          <a href={openUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => toggleVisibility(mat.id)} title={mat.isVisible ? 'Hide from students' : 'Show to students'}>
                          {mat.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMaterial(mat.id)}>
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

      <MaterialPreviewDialog material={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
