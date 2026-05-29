import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('group relative overflow-hidden', className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
        {trend && (
          <div className={cn('inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium', trend.positive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400')}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
