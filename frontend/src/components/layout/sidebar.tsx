'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore, type User } from '@/lib/store';
import {
  LayoutDashboard, Building2, Users, BookOpen, GraduationCap,
  ClipboardCheck, CreditCard, FileText, Bot, Bell, Settings,
  Baby, LogOut, ChevronLeft, Menu, Video, BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getInitials } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  section?: string;
}

function getNavItems(role: User['role']): NavItem[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Overview' },
        { label: 'Analytics', href: '/analytics', icon: BarChart2, section: 'Overview' },
        { label: 'Institutes', href: '/institutes', icon: Building2, section: 'Management' },
        { label: 'Users', href: '/users', icon: Users, section: 'Management' },
        { label: 'Settings', href: '/settings', icon: Settings, section: 'System' },
      ];
    case 'INSTITUTE_ADMIN':
      return [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Overview' },
        { label: 'Faculty', href: '/faculty', icon: Users, section: 'People' },
        { label: 'Students', href: '/students', icon: GraduationCap, section: 'People' },
        { label: 'Classes', href: '/classes', icon: BookOpen, section: 'Academics' },
        { label: 'Attendance', href: '/attendance', icon: ClipboardCheck, section: 'Academics' },
        { label: 'Payments', href: '/payments', icon: CreditCard, section: 'Finance' },
        { label: 'Settings', href: '/settings', icon: Settings, section: 'System' },
      ];
    case 'TEACHER':
      return [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Overview' },
        { label: 'My Classes', href: '/classes', icon: BookOpen, section: 'Teaching' },
        { label: 'Attendance', href: '/attendance', icon: ClipboardCheck, section: 'Teaching' },
        { label: 'Materials', href: '/materials', icon: FileText, section: 'Teaching' },
        { label: 'Live Sessions', href: '/live-sessions', icon: Video, section: 'Teaching' },
        { label: 'Reports', href: '/reports', icon: ClipboardCheck, section: 'Teaching' },
        { label: 'Notifications', href: '/notifications', icon: Bell, section: 'Account' },
        { label: 'My Profile', href: '/settings', icon: Settings, section: 'Account' },
      ];
    case 'STUDENT':
      return [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Overview' },
        { label: 'My Classes', href: '/classes', icon: BookOpen, section: 'Learning' },
        { label: 'Materials', href: '/materials', icon: FileText, section: 'Learning' },
        { label: 'Live Sessions', href: '/live-sessions', icon: Video, section: 'Learning' },
        { label: 'Mark Attendance', href: '/attendance', icon: ClipboardCheck, section: 'Learning' },
        { label: 'AI Tutor', href: '/ai-tutor', icon: Bot, section: 'Learning' },
        { label: 'My Fees', href: '/payments', icon: CreditCard, section: 'Account' },
        { label: 'Notifications', href: '/notifications', icon: Bell, section: 'Account' },
        { label: 'My Profile', href: '/settings', icon: Settings, section: 'Account' },
      ];
    case 'PARENT':
      return [
        { label: 'Dashboard', href: '/children', icon: LayoutDashboard, section: 'Overview' },
        { label: 'Attendance', href: '/children/attendance', icon: ClipboardCheck, section: 'My Child' },
        { label: 'Fees', href: '/children/fees', icon: CreditCard, section: 'My Child' },
        { label: 'Classes', href: '/children/classes', icon: BookOpen, section: 'My Child' },
        { label: 'Notifications', href: '/notifications', icon: Bell, section: 'Account' },
        { label: 'Profile', href: '/settings', icon: Settings, section: 'Account' },
      ];
    default:
      return [];
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const navItems = getNavItems(user.role);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar transition-all duration-300 relative',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Header: [icon] [name on the right] … [collapse icon only] */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-3',
          collapsed ? 'flex-col justify-center' : 'h-16 justify-between'
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            'flex min-w-0 items-center gap-2.5 group',
            collapsed ? 'justify-center' : 'flex-1'
          )}
          title="instituteOS"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
            iO
          </div>
          {!collapsed && (
            <div className="min-w-0 text-left">
              <span className="block text-base font-bold text-sidebar-foreground leading-none truncate">instituteOS</span>
              <span className="block text-[10px] text-muted-foreground font-medium tracking-wide">MANAGEMENT</span>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-sidebar-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 pb-4">
        <nav className="flex flex-col">
          {navItems.reduce<React.ReactNode[]>((acc, item, idx) => {
            const prevSection = idx > 0 ? navItems[idx - 1].section : null;
            if (!collapsed && item.section && item.section !== prevSection) {
              acc.push(
                <p key={`section-${item.section}`} className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {item.section}
                </p>
              );
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            acc.push(
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                  collapsed && 'justify-center px-2'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-primary')} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
            return acc;
          }, [])}
        </nav>
      </ScrollArea>

      {/* User */}
      <div className={cn('border-t p-3', collapsed && 'px-2')}>
        <div className={cn('flex items-center gap-3 rounded-lg p-2', collapsed && 'justify-center p-1')}>
          <Avatar className="h-9 w-9 ring-2 ring-primary/10">
            <AvatarImage src={user.profileImage} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{getInitials(user.fullName)}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.fullName}</p>
              <p className="text-[10px] text-muted-foreground truncate font-medium uppercase tracking-wider">{user.role.replace(/_/g, ' ')}</p>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
