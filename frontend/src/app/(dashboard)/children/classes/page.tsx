'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, ExternalLink, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { StudentProfile, Material } from '@/lib/types';
import logger from '@/lib/logger';

export default function ParentClassesPage() {
  const [children, setChildren] = useState<StudentProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    api.get('/parent/children').then(({ data }) => {
      const kids = data.data || [];
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0].id);
    }).catch(err => logger.error('Load children failed', err)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    const child = children.find(c => c.id === selectedChild);
    setEnrollments(child?.enrollments || []);
    setSelectedClass(null);
    setMaterials([]);
  }, [selectedChild, children]);

  async function viewClass(enrollment: any) {
    setSelectedClass(enrollment);
    try {
      const { data } = await api.get(`/parent/children/${selectedChild}/materials`);
      setMaterials((data.data || []).filter((m: Material) => m.isVisible));
    } catch { setMaterials([]); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Classes" description="View your child's enrolled classes" />

      {children.length > 1 && (
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Select child" /></SelectTrigger>
          <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.user?.fullName}</SelectItem>)}</SelectContent>
        </Select>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Class cards */}
        <div className="space-y-3">
          {enrollments.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Not enrolled in any class.</CardContent></Card>
          ) : (
            enrollments.map((e: any) => (
              <Card key={e.id} className={`cursor-pointer transition-colors ${selectedClass?.id === e.id ? 'border-primary ring-1 ring-primary' : ''}`} onClick={() => viewClass(e)}>
                <CardContent className="p-4 space-y-1">
                  <p className="font-medium">{e.class?.name}</p>
                  <div className="flex gap-1.5">
                    <Badge variant="secondary" className="text-xs">{e.class?.subject}</Badge>
                    <Badge variant="secondary" className="text-xs">{e.class?.grade}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Fee: {formatCurrency(e.class?.feeAmount)}/mo</p>
                  <p className="text-xs text-muted-foreground">{e.class?.scheduleDays?.join(', ')} at {e.class?.startTime}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right: Materials */}
        <div className="lg:col-span-2">
          {!selectedClass ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">Select a class to view materials</CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Materials — {selectedClass.class?.name}</CardTitle></CardHeader>
              <CardContent>
                {materials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No materials have been shared yet.</p>
                ) : (
                  <div className="space-y-3">
                    {materials.map(m => (
                      <div key={m.id} className="flex items-center justify-between rounded border p-3">
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{m.title}</p>
                            <Badge variant={m.type === 'PDF' ? 'destructive' : 'default'} className="text-[10px] mt-0.5">{m.type === 'PDF' ? 'PDF' : 'Video'}</Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <a href={m.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" />{m.type === 'PDF' ? 'Open PDF' : 'Watch'}</a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
        <Lock className="h-4 w-4 shrink-0" />
        This is read-only. Contact the institute for any concerns.
      </div>
    </div>
  );
}
