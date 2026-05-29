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

function getVideoEmbed(url: string): { type: 'youtube' | 'iframe' | 'video'; src: string; ytId?: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([-\w]+)/);
  if (ytMatch) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&autoplay=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`, ytId: ytMatch[1] };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) return { type: 'iframe', src: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  return { type: 'video', src: url };
}

function getPdfSrc(url: string): { mode: 'direct' | 'gdocs'; src: string } {
  // New Cloudinary auto-uploads are served under /image/upload/ with correct Content-Type
  if (url.includes('/image/upload/')) return { mode: 'direct', src: url };
  // Old raw uploads — use Google Docs Viewer as fallback
  return { mode: 'gdocs', src: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` };
}

function VideoPreview({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = getVideoEmbed(url);
  const h = 'calc(95vh - 56px)';

  if (embed.type === 'youtube') {
    return playing ? (
      <iframe
        src={embed.src}
        title={title}
        style={{ width: '100%', height: h, border: 'none', display: 'block' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    ) : (
      <div
        onClick={() => setPlaying(true)}
        style={{ width: '100%', height: h, background: '#000', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <img
          src={`https://img.youtube.com/vi/${embed.ytId}/hqdefault.jpg`}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
        />
        <div style={{ position: 'absolute', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play style={{ color: '#fff', width: 32, height: 32, marginLeft: 4 }} />
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 14, opacity: 0.9 }}>Click to play</div>
      </div>
    );
  }

  if (embed.type === 'iframe') {
    return (
      <iframe
        src={embed.src}
        title={title}
        style={{ width: '100%', height: h, border: 'none', display: 'block' }}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <video
      src={embed.src}
      controls
      style={{ width: '100%', height: h, display: 'block', background: '#000' }}
    />
  );
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
      // Fetch materials for all classes
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
        await api.post(`/materials/class/${form.classId}`, form);
      }
      toast.success('Material uploaded');
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
      toast.success('Visibility toggled');
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

  if (loading) return <CardGridSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Materials" description="Class materials and resources">
        {isTeacher && (
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
                      <SelectItem value="VIDEO_LINK">Video Link</SelectItem>
                      <SelectItem value="LIVE_LINK">Live Session Link (Zoom / Meet / Teams)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.type === 'PDF' ? (
                  <div key="file-input" className="space-y-2">
                    <Label>File</Label>
                    <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                  </div>
                ) : (
                  <div key="url-input" className="space-y-2">
                    <Label>{form.type === 'LIVE_LINK' ? 'Meeting Link' : 'URL'}</Label>
                    <Input value={form.url} onChange={(e) => { let v = e.target.value; if (v && !v.match(/^https?:\/\//)) v = 'https://' + v; setForm({ ...form, url: v }); }} placeholder={form.type === 'LIVE_LINK' ? 'https://zoom.us/j/... or meet.google.com/...' : 'https://...'} required />
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      {materials.length === 0 ? (
        <EmptyState title="No materials" description="Upload study materials for your classes" icon={FileText} />
      ) : (
        <div className="space-y-3">
          {materials.map((mat) => {
            const platform = mat.type === 'LIVE_LINK' ? getLivePlatform(mat.url) : null;
            return (
              <Card key={mat.id} className={mat.type === 'LIVE_LINK' ? 'border-l-4' : ''} style={mat.type === 'LIVE_LINK' ? { borderLeftColor: platform?.color } : {}}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {mat.type === 'LIVE_LINK' ? (
                      <div className="flex h-9 w-9 rounded-lg items-center justify-center" style={{ background: platform?.bg }}>
                        <Video className="h-4 w-4" style={{ color: platform?.color }} />
                      </div>
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{mat.title}</p>
                        {mat.type === 'LIVE_LINK' && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: platform?.color, background: platform?.bg }}>{platform?.label}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{mat.class?.name} &middot; {formatDate(mat.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={mat.isVisible ? 'success' : 'secondary'}>
                      {mat.isVisible ? 'Visible' : 'Hidden'}
                    </Badge>
                    {mat.type === 'LIVE_LINK' ? (
                      <Button size="sm" asChild style={{ background: platform?.color, color: '#fff' }}>
                        <a href={mat.url?.startsWith('http') ? mat.url : `https://${mat.url}`} target="_blank" rel="noopener noreferrer">Join</a>
                      </Button>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => setPreview(mat)} title="Preview">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" asChild title="Open in new tab">
                          <a href={mat.url?.startsWith('http') ? mat.url : `https://${mat.url}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      </>
                    )}
                    {isTeacher && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => toggleVisibility(mat.id)}>
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
      {preview && (
        <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
          <DialogContent className="max-w-4xl w-full p-0" style={{ maxHeight: '95vh', overflow: 'hidden' }}>
            <DialogHeader className="px-5 py-3 border-b">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                  {preview.type === 'PDF' ? <FileText className="h-4 w-4 shrink-0" /> : <Play className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{preview.title}</span>
                </DialogTitle>
                <a href={preview.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary whitespace-nowrap">
                  <ExternalLink className="h-3 w-3" /> Open in new tab
                </a>
              </div>
            </DialogHeader>
            {preview.type === 'PDF' ? (
              <iframe
                key={preview.id}
                src={getPdfSrc(preview.url).src}
                title={preview.title}
                style={{ width: '100%', height: 'calc(95vh - 56px)', border: 'none', display: 'block' }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            ) : (
              <VideoPreview key={preview.id} url={preview.url} title={preview.title} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
