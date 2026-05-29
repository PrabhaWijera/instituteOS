'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Check, AlertTriangle, CreditCard, ClipboardCheck, Settings2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';
import type { Notification } from '@/lib/types';
import logger from '@/lib/logger';

const TYPE_ICON: Record<string, React.ElementType> = {
  ATTENDANCE: ClipboardCheck,
  ENROLLMENT: ClipboardCheck,
  PAYMENT: CreditCard,
  PAYMENT_RECEIPT: CreditCard,
  FEE_DUE: CreditCard,
  ALERT: AlertTriangle,
  SYSTEM: Settings2,
};

const TYPE_COLOR: Record<string, string> = {
  ATTENDANCE: 'text-blue-500',
  ENROLLMENT: 'text-blue-500',
  PAYMENT: 'text-amber-500',
  PAYMENT_RECEIPT: 'text-green-500',
  FEE_DUE: 'text-amber-500',
  ALERT: 'text-red-500',
  SYSTEM: 'text-muted-foreground',
};

const TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Attendance',
  ENROLLMENT: 'Enrollment',
  PAYMENT: 'Payment',
  PAYMENT_RECEIPT: 'Receipt',
  FEE_DUE: 'Fee Due',
  ALERT: 'Alert',
  SYSTEM: 'System',
};

export default function NotificationsPage() {
  const user = useAuthStore(s => s.user);
  const isParent = user?.role === 'PARENT';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({ attendance: true, payment: true, system: true });

  useEffect(() => {
    api.get('/notifications').then(({ data }) => setNotifications(data.data || []))
      .catch((err) => logger.error('Failed to load notifications', err)).finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) { logger.error('Mark read failed', err); toast.error('Failed'); }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All marked as read');
    } catch (err) { logger.error('Mark all read failed', err); toast.error('Failed'); }
  }

  if (loading) return <Loading />;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`${unreadCount} unread`}>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPrefs(!showPrefs)}>
            <Settings2 className="h-4 w-4 mr-1" />Preferences
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-1" />Mark all read
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Preferences panel */}
      {showPrefs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification Preferences</CardTitle>
            <CardDescription>Choose which notifications you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Attendance blocked - always ON */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium">Attendance Blocked</p>
                  <p className="text-xs text-muted-foreground">Alerts when attendance is blocked due to overdue fees</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={true} disabled />
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Attendance Updates</p>
                  <p className="text-xs text-muted-foreground">{isParent ? 'When your child is marked absent' : 'Session start/end alerts'}</p>
                </div>
              </div>
              <Switch checked={prefs.attendance} onCheckedChange={v => setPrefs({ ...prefs, attendance: v })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">Payment Reminders</p>
                  <p className="text-xs text-muted-foreground">Fee due dates and payment confirmations</p>
                </div>
              </div>
              <Switch checked={prefs.payment} onCheckedChange={v => setPrefs({ ...prefs, payment: v })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">System Updates</p>
                  <p className="text-xs text-muted-foreground">General announcements and system notices</p>
                </div>
              </div>
              <Switch checked={prefs.system} onCheckedChange={v => setPrefs({ ...prefs, system: v })} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification list */}
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">No notifications at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const Icon = TYPE_ICON[notif.type] || Bell;
            const color = TYPE_COLOR[notif.type] || 'text-primary';
            return (
              <Card key={notif.id} className={notif.isRead ? 'opacity-60' : ''}>
                <CardContent className="flex items-start justify-between p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                    <div>
                      <p className="font-medium text-sm">{notif.title}</p>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDateTime(notif.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{TYPE_LABEL[notif.type] || notif.type}</Badge>
                    {!notif.isRead && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(notif.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
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
