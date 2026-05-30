import { cn } from '@/lib/utils';

interface WidgetGridProps {
  children: React.ReactNode;
  className?: string;
}

export function WidgetGrid({ children, className }: WidgetGridProps) {
  return (
    <div className={cn(
      'grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-start w-full',
      className,
    )}>
      {children}
    </div>
  );
}
