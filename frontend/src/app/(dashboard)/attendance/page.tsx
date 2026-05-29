'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardCheck, Loader2, MapPin, CheckCircle2, XCircle, AlertTriangle,
  UserPlus, Activity, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, getInitials } from '@/lib/utils';
import type { TuitionClass, AttendanceSession } from '@/lib/types';
import logger from '@/lib/logger';

// Student OTP verification states
type StudentState = 'idle' | 'enter_otp' | 'verifying' | 'success' | 'outside_range' | 'fee_blocked' | 'wrong_otp';

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'INSTITUTE_ADMIN';
  const isStudent = user?.role === 'STUDENT';
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [classes, setClasses] = useState<TuitionClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Teacher: start session
  const [startOpen, setStartOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');

  // Teacher: live board
  const [liveSession, setLiveSession] = useState<any>(null);
  const [liveRecords, setLiveRecords] = useState<any[]>([]);

  // Teacher: manual mark
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualSessionId, setManualSessionId] = useState('');
  const [manualStudents, setManualStudents] = useState<any[]>([]);
  const [marking, setMarking] = useState(false);

  // Student states
  const [studentState, setStudentState] = useState<StudentState>('idle');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'pending' | 'acquired' | 'denied'>('pending');
  const [studentHistory, setStudentHistory] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      if (isTeacher || isAdmin) {
        const [sessRes, classRes] = await Promise.all([
          api.get('/attendance/sessions'),
          api.get(isTeacher ? '/classes/my' : '/classes'),
        ]);
        setSessions(sessRes.data.data || []);
        setClasses(classRes.data.data || []);
      } else if (isStudent) {
        const { data } = await api.get('/attendance/history/me');
        setStudentHistory(data.data || []);
      }
    } catch (err) { logger.error('Failed to load data', err); } finally { setLoading(false); }
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* GPS optional for teacher */ }

      const { data } = await api.post('/attendance/sessions', { classId: selectedClass, lat, lng });
      toast.success('Session started');
      setStartOpen(false);
      openLiveBoard(data.data);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setStarting(false); }
  }

  function openLiveBoard(session: any) {
    setLiveSession(session);
    setLiveRecords(session.records || []);
  }

  async function refreshLiveBoard() {
    if (!liveSession) return;
    try {
      const { data } = await api.get(`/attendance/sessions/${liveSession.id}`);
      setLiveSession(data.data);
      setLiveRecords(data.data.records || []);
    } catch { /* ignore */ }
  }

  async function endSession(id: string) {
    try {
      await api.patch(`/attendance/sessions/${id}/end`);
      toast.success('Session ended');
      setLiveSession(null);
      fetchData();
    } catch { toast.error('Failed'); }
  }

  async function openManualMark(sessionId: string) {
    setManualSessionId(sessionId);
    try {
      const sess = sessions.find(s => s.id === sessionId) || liveSession;
      if (sess?.classId) {
        const { data } = await api.get(`/classes/${sess.classId}`);
        const enrollments = data.data?.enrollments || [];
        const markedIds = new Set((liveRecords || []).map((r: any) => r.studentId));
        setManualStudents(enrollments.filter((e: any) => !markedIds.has(e.student?.id)).map((e: any) => e.student));
      }
    } catch { /* ignore */ }
    setManualOpen(true);
  }

  async function handleManualMark() {
    if (!manualStudentId || !manualSessionId) return;
    setMarking(true);
    try {
      await api.post('/attendance/manual', { sessionId: manualSessionId, studentId: manualStudentId, status: 'PRESENT' });
      toast.success('Marked present');
      setManualOpen(false);
      setManualStudentId('');
      refreshLiveBoard();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setMarking(false); }
  }

  // Student: verify OTP
  async function handleVerifyOtp() {
    setStudentState('verifying');
    setVerifying(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      setGpsStatus('pending');
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        setGpsStatus('acquired');
      } catch {
        setGpsStatus('denied');
      }

      await api.post('/attendance/verify-otp', { otp, lat, lng });
      setStudentState('success');
      toast.success('Attendance marked!');
      setTimeout(() => { setStudentState('idle'); setOtp(''); fetchData(); }, 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error.response?.data?.message?.toLowerCase() || '';
      if (msg.includes('range') || msg.includes('gps') || msg.includes('location')) {
        setStudentState('outside_range');
      } else if (msg.includes('block') || msg.includes('suspend') || msg.includes('fee')) {
        setStudentState('fee_blocked');
      } else {
        setStudentState('wrong_otp');
      }
    } finally { setVerifying(false); }
  }

  if (loading) return <Loading />;

  const ongoingSessions = sessions.filter(s => s.status === 'ONGOING' || s.isActive);
  const pastSessions = sessions.filter(s => s.status !== 'ONGOING' && !s.isActive);

  // ======= STUDENT VIEW =======
  if (isStudent) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mark Attendance" description="Enter the OTP shown by your teacher" />

        {/* GPS status bar */}
        <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${gpsStatus === 'acquired' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : gpsStatus === 'denied' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}>
          <MapPin className="h-4 w-4" />
          {gpsStatus === 'acquired' ? 'GPS acquired' : gpsStatus === 'denied' ? 'GPS denied — attendance may fail' : 'GPS will be requested when you verify'}
        </div>

        {/* State 1: Idle / Enter OTP */}
        {(studentState === 'idle' || studentState === 'enter_otp') && (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center space-y-6">
              <ClipboardCheck className="h-16 w-16 mx-auto text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Enter Attendance OTP</h2>
                <p className="text-sm text-muted-foreground mt-1">Ask your teacher for the code displayed on the board</p>
              </div>
              <Input
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="text-center text-3xl tracking-[0.5em] font-mono h-16"
              />
              <Button className="w-full h-12 text-lg" disabled={otp.length < 4 || verifying} onClick={handleVerifyOtp}>
                {verifying && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}Verify & Mark
              </Button>
            </CardContent>
          </Card>
        )}

        {/* State 2: Verifying */}
        {studentState === 'verifying' && (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-12 text-center space-y-4">
              <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
              <p className="text-lg font-medium">Verifying OTP &amp; location...</p>
              <p className="text-sm text-muted-foreground">Please wait, checking your credentials</p>
            </CardContent>
          </Card>
        )}

        {/* State 3: Success */}
        {studentState === 'success' && (
          <Card className="max-w-md mx-auto border-green-300">
            <CardContent className="p-12 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <p className="text-xl font-semibold text-green-700 dark:text-green-400">Attendance Marked!</p>
              <p className="text-sm text-muted-foreground">You&apos;re all set. This will auto-dismiss.</p>
            </CardContent>
          </Card>
        )}

        {/* State 4: Outside range */}
        {studentState === 'outside_range' && (
          <Card className="max-w-md mx-auto border-amber-300">
            <CardContent className="p-12 text-center space-y-4">
              <MapPin className="h-16 w-16 mx-auto text-amber-500" />
              <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">Outside Range</p>
              <p className="text-sm text-muted-foreground">You need to be within the institute area. Move closer and try again.</p>
              <Button onClick={() => setStudentState('idle')}>Try Again</Button>
            </CardContent>
          </Card>
        )}

        {/* State 5: Fee blocked */}
        {studentState === 'fee_blocked' && (
          <Card className="max-w-md mx-auto border-red-300">
            <CardContent className="p-12 text-center space-y-4">
              <AlertTriangle className="h-16 w-16 mx-auto text-red-500" />
              <p className="text-xl font-semibold text-red-700 dark:text-red-400">Attendance Blocked</p>
              <p className="text-sm text-muted-foreground">Your fee payment is overdue. Contact the institute to resolve this.</p>
              <Button variant="outline" onClick={() => setStudentState('idle')}>Back</Button>
            </CardContent>
          </Card>
        )}

        {/* State 6: Wrong OTP */}
        {studentState === 'wrong_otp' && (
          <Card className="max-w-md mx-auto border-red-300">
            <CardContent className="p-12 text-center space-y-4">
              <XCircle className="h-16 w-16 mx-auto text-red-500" />
              <p className="text-xl font-semibold text-red-700 dark:text-red-400">Wrong OTP</p>
              <p className="text-sm text-muted-foreground">The code you entered is incorrect or expired. Check with your teacher.</p>
              <Button onClick={() => { setStudentState('idle'); setOtp(''); }}>Try Again</Button>
            </CardContent>
          </Card>
        )}

        {/* Student history */}
        {studentHistory.length > 0 && studentState === 'idle' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Attendance</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentHistory.slice(0, 20).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{formatDate(r.checkInTime || r.createdAt)}</TableCell>
                      <TableCell className="text-sm">{r.session?.class?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="success" className="text-xs">
                          {r.isManual ? 'PRESENT (Manual)' : 'PRESENT'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ======= TEACHER/ADMIN VIEW =======
  if (!isTeacher && !isAdmin) return null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description={isTeacher ? 'Manage attendance sessions' : 'View attendance sessions'}
      >
        {isTeacher && (
          <Button onClick={() => setStartOpen(true)}><ClipboardCheck className="h-4 w-4 mr-2" />Start Session</Button>
        )}
      </PageHeader>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Active Sessions" value={ongoingSessions.length} icon={Activity} />
        <StatCard title="Total Sessions" value={sessions.length} icon={ClipboardCheck} />
        <StatCard title="Total Marked" value={sessions.reduce((s, sess) => s + (sess._count?.records || 0), 0)} icon={Users} />
        <StatCard title="Classes" value={classes.length} icon={ClipboardCheck} />
      </div>

      {/* Live board for active session */}
      {liveSession && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Live Session — {liveSession.class?.name}</CardTitle>
                <p className="text-4xl font-bold text-primary mt-2 font-mono tracking-widest">{liveSession.otpCode || liveSession.otp}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refreshLiveBoard}>Refresh</Button>
                {isTeacher && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openManualMark(liveSession.id)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" />Manual Mark
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => endSession(liveSession.id)}>End Session</Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{liveRecords.length} students marked present</p>
            {liveRecords.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {liveRecords.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 rounded border p-2">
                    <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{getInitials(r.student?.user?.fullName || '?')}</AvatarFallback></Avatar>
                    <span className="text-sm flex-1">{r.student?.user?.fullName}</span>
                    <Badge variant={r.isManual ? 'warning' : 'default'} className="text-[10px]">{r.isManual ? 'Manual' : 'OTP'}</Badge>
                    <span className="text-xs text-muted-foreground">{r.markedAt ? new Date(r.markedAt).toLocaleTimeString() : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ongoing sessions */}
      {ongoingSessions.length > 0 && !liveSession && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Live Sessions</h3>
          {ongoingSessions.map(s => (
            <Card key={s.id} className="border-l-4 border-l-green-500 cursor-pointer" onClick={() => openLiveBoard(s)}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{s.class?.name}</p>
                  <p className="text-lg font-bold text-primary">OTP: {s.otpCode || s.otp}</p>
                  <p className="text-xs text-muted-foreground">Started: {formatDate(s.startedAt || s.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{s._count?.records || 0} marked</Badge>
                  {isTeacher && (
                    <Button variant="destructive" size="sm" onClick={e => { e.stopPropagation(); endSession(s.id); }}>End</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Past sessions */}
      {pastSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Past Sessions</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastSessions.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-medium">{s.class?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{formatDate(s.startedAt || s.createdAt)}</TableCell>
                    <TableCell className="text-sm">{s.startedAt && s.endedAt ? `${Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)} min` : '—'}</TableCell>
                    <TableCell className="text-sm">{s._count?.records || 0}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">Ended</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Start session dialog */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start Attendance Session</DialogTitle></DialogHeader>
          <form onSubmit={handleStart} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>
                  {classes.filter(c => c.isActive !== false).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">A 6-digit OTP will be generated. Share it with your students.</p>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setStartOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!selectedClass || starting}>
                {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start Session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual mark dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manual Mark Attendance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={manualStudentId} onValueChange={setManualStudentId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {manualStudents.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.user?.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">This will be flagged as a manual entry in the report.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
              <Button disabled={!manualStudentId || marking} onClick={handleManualMark}>
                {marking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark Present
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
