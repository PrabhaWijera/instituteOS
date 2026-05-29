'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/layout/page-header';
import { TableSkeleton } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Lock, Building2, CreditCard, Bell, MapPin, User, Key, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import logger from '@/lib/logger';

type Section = 'campus' | 'billing' | 'notifications' | 'attendance' | 'profile' | 'password';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const isAdmin = user?.role === 'INSTITUTE_ADMIN';
  const isStudent = user?.role === 'STUDENT';

  const [section, setSection] = useState<Section>(isAdmin ? 'campus' : 'profile');
  const [institute, setInstitute] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(isAdmin);

  // Profile form
  const [profile, setProfile] = useState({ fullName: user?.fullName || '', phone: user?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [studentDetails, setStudentDetails] = useState({
    dob: '',
    gender: '',
    address: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
  });
  const [savingStudentDetails, setSavingStudentDetails] = useState(false);
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // Profile image upload
  const [uploadingImage, setUploadingImage] = useState(false);

  // Password form
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  // Institute campus form
  const [campus, setCampus] = useState({ name: '', address: '', city: '', phone: '', lat: '', lng: '' });
  const [savingCampus, setSavingCampus] = useState(false);

  // Billing rules
  const [billing, setBilling] = useState({ billingCycleDays: 30, gracePeriodDays: 5, autoSuspendAfterDays: 7 });
  const [savingBilling, setSavingBilling] = useState(false);

  // Attendance settings
  const [attendance, setAttendance] = useState({ otpExpiryMinutes: 10, geofenceRadiusMeters: 1000, allowManualOverride: true });
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Notification settings
  const [notifs, setNotifs] = useState({ notifyAbsent: true, notifyFeeDue: true, notifyEnrollment: true, notifyParentInvite: true, notifyPaymentReceipt: true });
  const [savingNotifs, setSavingNotifs] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      api.get('/institutes/me'),
      api.get('/institutes/me/settings'),
    ]).then(([instRes, setRes]) => {
      const inst = instRes.data.data;
      const set = setRes.data.data;
      setInstitute(inst);
      setSettings(set);
      setCampus({ name: inst.name || '', address: inst.address || '', city: inst.city || '', phone: inst.phone || '', lat: inst.lat || '', lng: inst.lng || '' });
      setBilling({
        billingCycleDays: set?.billingCycleDays ?? 30,
        gracePeriodDays: set?.gracePeriodDays ?? 5,
        autoSuspendAfterDays: set?.autoSuspendAfterDays ?? 7,
      });
      setAttendance({
        otpExpiryMinutes: set?.otpExpiryMinutes ?? 10,
        geofenceRadiusMeters: set?.geofenceRadiusMeters ?? 1000,
        allowManualOverride: set?.allowManualOverride ?? true,
      });
      setNotifs({
        notifyAbsent: set?.notifyAbsent ?? true,
        notifyFeeDue: set?.notifyFeeDue ?? true,
        notifyEnrollment: set?.notifyEnrollment ?? true,
        notifyParentInvite: set?.notifyParentInvite ?? true,
        notifyPaymentReceipt: set?.notifyPaymentReceipt ?? true,
      });
    }).catch(err => logger.error('Failed to load settings', err)).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isStudent) return;

    setLoading(true);
    api.get('/students/me')
      .then(({ data }) => {
        const student = data.data;
        setStudentProfile(student);
        setStudentDetails({
          dob: student.dob ? student.dob.slice(0, 10) : '',
          gender: student.gender || '',
          address: student.address || '',
          parentName: student.parentName || '',
          parentEmail: student.parentEmail || '',
          parentPhone: student.parentPhone || '',
        });
      })
      .catch(err => logger.error('Failed to load student profile', err))
      .finally(() => setLoading(false));
  }, [isStudent]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/auth/profile', profile);
      setUser(data.data);
      toast.success('Profile updated');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setSavingProfile(false); }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const { data } = await api.post('/auth/profile/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser({ ...user!, ...data.data });
      toast.success('Profile photo updated');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.newPassword.length < 8) { toast.error('At least 8 characters'); return; }
    setSavingPassword(true);
    try {
      await api.post('/auth/password/change', { currentPassword: password.currentPassword, newPassword: password.newPassword });
      toast.success('Password changed');
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed');
    } finally { setSavingPassword(false); }
  }

  async function handleStudentDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingStudentDetails(true);
    try {
      const payload = {
        dob: studentDetails.dob ? new Date(`${studentDetails.dob}T00:00:00.000Z`).toISOString() : undefined,
        gender: studentDetails.gender || undefined,
        address: studentDetails.address || undefined,
        parentName: studentDetails.parentName || undefined,
        parentEmail: studentDetails.parentEmail || undefined,
        parentPhone: studentDetails.parentPhone || undefined,
      };
      const { data } = await api.patch('/students/me/onboarding', payload);
      setStudentProfile(data.data);
      toast.success('Student details saved');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to save student details');
    } finally { setSavingStudentDetails(false); }
  }

  async function handleSubmitForVerification() {
    setSubmittingProfile(true);
    try {
      const { data } = await api.post('/students/me/submit');
      setStudentProfile(data.data);
      toast.success('Profile submitted for verification');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to submit profile');
    } finally { setSubmittingProfile(false); }
  }

  async function saveCampus(e: React.FormEvent) {
    e.preventDefault();
    setSavingCampus(true);
    try {
      await api.patch('/institutes/me', { name: campus.name, address: campus.address, city: campus.city, phone: campus.phone, lat: campus.lat ? parseFloat(campus.lat) : undefined, lng: campus.lng ? parseFloat(campus.lng) : undefined });
      toast.success('Campus info updated');
    } catch { toast.error('Failed'); } finally { setSavingCampus(false); }
  }

  async function saveBilling(e: React.FormEvent) {
    e.preventDefault();
    setSavingBilling(true);
    try {
      await api.patch('/institutes/me/settings', billing);
      toast.success('Billing rules saved');
    } catch { toast.error('Failed'); } finally { setSavingBilling(false); }
  }

  async function saveAttendance(e: React.FormEvent) {
    e.preventDefault();
    setSavingAttendance(true);
    try {
      await api.patch('/institutes/me/settings', attendance);
      toast.success('Attendance settings saved');
    } catch { toast.error('Failed'); } finally { setSavingAttendance(false); }
  }

  async function saveNotifs(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotifs(true);
    try {
      await api.patch('/institutes/me/settings', notifs);
      toast.success('Notification settings saved');
    } catch { toast.error('Failed'); } finally { setSavingNotifs(false); }
  }

  if (loading) return <TableSkeleton />;

  const adminSections: { key: Section; label: string; icon: React.ElementType }[] = [
    { key: 'campus', label: 'Campus Info', icon: Building2 },
    { key: 'billing', label: 'Billing Rules', icon: CreditCard },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'attendance', label: 'Attendance', icon: MapPin },
    { key: 'profile', label: 'My Profile', icon: User },
    { key: 'password', label: 'Password', icon: Key },
  ];

  const nonAdminSections: { key: Section; label: string; icon: React.ElementType }[] = [
    { key: 'profile', label: 'My Profile', icon: User },
    { key: 'password', label: 'Password', icon: Key },
  ];

  const sections = isAdmin ? adminSections : nonAdminSections;

  return (
    <div className="space-y-6">
      <PageHeader title={isStudent ? 'My Profile' : 'Settings'} description={isStudent ? 'View and manage your profile' : 'Manage institute and account settings'} />

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left nav */}
        <div className="space-y-1">
          {sections.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${section === s.key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}`}>
              <s.icon className="h-4 w-4" />{s.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Campus Info */}
          {section === 'campus' && isAdmin && (
            <Card>
              <CardHeader><CardTitle>Campus Information</CardTitle><CardDescription>Update your institute details and GPS coordinates</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={saveCampus} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Institute Name</Label><Input value={campus.name} onChange={e => setCampus({ ...campus, name: e.target.value })} /></div>
                    <div className="space-y-2"><Label>City</Label><Input value={campus.city} onChange={e => setCampus({ ...campus, city: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Address</Label><Input value={campus.address} onChange={e => setCampus({ ...campus, address: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={campus.phone} onChange={e => setCampus({ ...campus, phone: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" placeholder="e.g. 6.9271" value={campus.lat} onChange={e => setCampus({ ...campus, lat: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" placeholder="e.g. 79.8612" value={campus.lng} onChange={e => setCampus({ ...campus, lng: e.target.value })} /></div>
                  </div>
                  <Button type="submit" disabled={savingCampus}>{savingCampus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Campus Info</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Billing Rules */}
          {section === 'billing' && isAdmin && (
            <Card>
              <CardHeader><CardTitle>Billing Rules</CardTitle><CardDescription>Configure billing cycle, grace period, and auto-suspend</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={saveBilling} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Billing Cycle (days)</Label><Input type="number" min={7} max={90} value={billing.billingCycleDays} onChange={e => setBilling({ ...billing, billingCycleDays: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Grace Period (days)</Label><Input type="number" min={0} value={billing.gracePeriodDays} onChange={e => setBilling({ ...billing, gracePeriodDays: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Auto-Suspend (days)</Label><Input type="number" min={0} value={billing.autoSuspendAfterDays} onChange={e => setBilling({ ...billing, autoSuspendAfterDays: Number(e.target.value) })} /></div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Billing cycle day: On this day each month, new dues are created for all enrolled students.</p>
                    <p>Grace period: Days after due date before a payment reminder is sent.</p>
                    <p>Auto-suspend: Days after due date before enrollment is suspended (blocks attendance).</p>
                  </div>
                  <Button type="submit" disabled={savingBilling}>{savingBilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Billing Rules</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Notifications */}
          {section === 'notifications' && isAdmin && (
            <Card>
              <CardHeader><CardTitle>Notification Settings</CardTitle><CardDescription>Control which notifications your institute sends</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={saveNotifs} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Absent Alerts</p><p className="text-xs text-muted-foreground">Notify parents when student is absent</p></div><Switch checked={notifs.notifyAbsent} onCheckedChange={v => setNotifs({ ...notifs, notifyAbsent: v })} /></div>
                    <Separator />
                    <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Fee Due Alerts</p><p className="text-xs text-muted-foreground">Send reminders for unpaid fees</p></div><Switch checked={notifs.notifyFeeDue} onCheckedChange={v => setNotifs({ ...notifs, notifyFeeDue: v })} /></div>
                    <Separator />
                    <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Enrollment Notifications</p><p className="text-xs text-muted-foreground">Notify when a student is enrolled</p></div><Switch checked={notifs.notifyEnrollment} onCheckedChange={v => setNotifs({ ...notifs, notifyEnrollment: v })} /></div>
                    <Separator />
                    <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Parent Invite Notifications</p><p className="text-xs text-muted-foreground">Send invite email to parents</p></div><Switch checked={notifs.notifyParentInvite} onCheckedChange={v => setNotifs({ ...notifs, notifyParentInvite: v })} /></div>
                    <Separator />
                    <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Payment Receipt</p><p className="text-xs text-muted-foreground">Send receipt when payment is recorded</p></div><Switch checked={notifs.notifyPaymentReceipt} onCheckedChange={v => setNotifs({ ...notifs, notifyPaymentReceipt: v })} /></div>
                  </div>
                  <Button type="submit" disabled={savingNotifs}>{savingNotifs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Notification Settings</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Attendance */}
          {section === 'attendance' && isAdmin && (
            <Card>
              <CardHeader><CardTitle>Attendance Settings</CardTitle><CardDescription>Configure OTP, GPS, and manual marking</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={saveAttendance} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>OTP Expiry (minutes)</Label><Input type="number" min={1} max={30} value={attendance.otpExpiryMinutes} onChange={e => setAttendance({ ...attendance, otpExpiryMinutes: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>GPS Radius (meters)</Label><Input type="number" min={50} value={attendance.geofenceRadiusMeters} onChange={e => setAttendance({ ...attendance, geofenceRadiusMeters: Number(e.target.value) })} /></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Allow Manual Mark</p><p className="text-xs text-muted-foreground">Let teachers mark students manually</p></div>
                    <Switch checked={attendance.allowManualOverride} onCheckedChange={v => setAttendance({ ...attendance, allowManualOverride: v })} />
                  </div>
                  <Button type="submit" disabled={savingAttendance}>{savingAttendance && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Attendance Settings</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Profile */}
          {section === 'profile' && (
            <Card>
              <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
              <CardContent>
                {/* Profile photo */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={user?.profileImage} />
                      <AvatarFallback className="text-lg">{getInitials(user?.fullName || '')}</AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="profile-image-upload"
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
                      title="Upload photo"
                    >
                      {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    </label>
                    <input
                      id="profile-image-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </div>
                  <div>
                    <p className="font-medium">{user?.fullName}</p>
                    <p className="text-sm text-muted-foreground">Click the camera icon to update your photo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG or WebP · max 5 MB</p>
                  </div>
                </div>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="flex items-center gap-2">
                      <Input value={user?.email || ''} disabled className="bg-muted" />
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{user?.role?.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {section === 'profile' && isStudent && (
            <Card>
              <CardHeader>
                <CardTitle>Student Details</CardTitle>
                <CardDescription>Complete these details so your institute admin can verify your profile.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Verification status:</span>
                  <Badge variant={studentProfile?.verificationStatus === 'VERIFIED' ? 'success' : studentProfile?.verificationStatus === 'PENDING_VERIFICATION' ? 'warning' : 'secondary'}>
                    {studentProfile?.verificationStatus?.replace('_', ' ') || 'PENDING PROFILE'}
                  </Badge>
                </div>
                <form onSubmit={handleStudentDetailsSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={studentDetails.dob}
                        onChange={e => setStudentDetails({ ...studentDetails, dob: e.target.value })}
                        disabled={studentProfile?.verificationStatus !== 'PENDING_PROFILE'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select
                        value={studentDetails.gender}
                        onValueChange={value => setStudentDetails({ ...studentDetails, gender: value })}
                        disabled={studentProfile?.verificationStatus !== 'PENDING_PROFILE'}
                      >
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={studentDetails.address}
                      onChange={e => setStudentDetails({ ...studentDetails, address: e.target.value })}
                      disabled={studentProfile?.verificationStatus !== 'PENDING_PROFILE'}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Parent Name</Label>
                      <Input
                        value={studentDetails.parentName}
                        onChange={e => setStudentDetails({ ...studentDetails, parentName: e.target.value })}
                        disabled={studentProfile?.verificationStatus !== 'PENDING_PROFILE'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent Email</Label>
                      <Input
                        type="email"
                        value={studentDetails.parentEmail}
                        onChange={e => setStudentDetails({ ...studentDetails, parentEmail: e.target.value })}
                        disabled={studentProfile?.verificationStatus !== 'PENDING_PROFILE'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent Phone</Label>
                      <Input
                        value={studentDetails.parentPhone}
                        onChange={e => setStudentDetails({ ...studentDetails, parentPhone: e.target.value })}
                        disabled={studentProfile?.verificationStatus !== 'PENDING_PROFILE'}
                      />
                    </div>
                  </div>
                  {studentProfile?.verificationStatus === 'PENDING_PROFILE' && (
                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" disabled={savingStudentDetails}>
                        {savingStudentDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Student Details
                      </Button>
                      <Button type="button" variant="outline" onClick={handleSubmitForVerification} disabled={submittingProfile}>
                        {submittingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for Verification
                      </Button>
                    </div>
                  )}
                  {studentProfile?.verificationStatus === 'PENDING_VERIFICATION' && (
                    <p className="text-sm text-muted-foreground">Your profile is waiting for institute admin verification.</p>
                  )}
                  {studentProfile?.verificationStatus === 'VERIFIED' && (
                    <p className="text-sm text-muted-foreground">Your profile is verified. Contact your institute admin if anything needs to change.</p>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Password */}
          {section === 'password' && (
            <Card>
              <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                  <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={password.currentPassword} onChange={e => setPassword({ ...password, currentPassword: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>New Password</Label><Input type="password" value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={password.confirmPassword} onChange={e => setPassword({ ...password, confirmPassword: e.target.value })} required /></div>
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Change Password
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
