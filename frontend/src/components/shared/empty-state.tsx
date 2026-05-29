import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children?: React.ReactNode;
}

export function EmptyState({ title, description, icon: Icon = FileQuestion, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-5">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
