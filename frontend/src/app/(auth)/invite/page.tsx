'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, Mail, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token') || '';
  const setUser = useAuthStore((s) => s.setUser);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [lookingUp, setLookingUp] = useState(!!tokenParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tokenParam) return;
    api.get(`/auth/invite/${tokenParam}`)
      .then(({ data }) => setInviteEmail(data.data.email))
      .catch((err) => setInviteError(err.response?.data?.message || 'Invalid or expired invite link'))
      .finally(() => setLookingUp(false));
  }, [tokenParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/invite/accept', { token: tokenParam, password });
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
      toast.success('Account activated!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to accept invite');
    } finally { setLoading(false); }
  }

  if (lookingUp) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!tokenParam) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <p className="font-semibold text-destructive">Invite link required</p>
          <p className="text-sm text-muted-foreground">Open the invite link from your email to activate your account.</p>
          <Link href="/login"><Button variant="outline" className="w-full">Back to Login</Button></Link>
        </CardContent>
      </Card>
    );
  }

  if (inviteError) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <p className="font-semibold text-destructive">{inviteError}</p>
          <p className="text-sm text-muted-foreground">Contact your administrator to request a new invite.</p>
          <Link href="/login"><Button variant="outline" className="w-full">Back to Login</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Your Password</CardTitle>
        <CardDescription>Activate your account to get started</CardDescription>
      </CardHeader>
      <CardContent>
        {inviteEmail && (
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 border px-4 py-3 mb-5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Setting up account for</p>
              <p className="text-sm font-semibold">{inviteEmail}</p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Activate Account
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <InviteForm />
    </Suspense>
  );
}
