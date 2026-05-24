import { cn } from '@/lib/utils';

export interface ProgressProps extends React.ComponentProps<'div'> {
  value?: number;
}

export function Progress({ className, value = 0, ...props }: ProgressProps) {
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} {...props}>
      <div
        className="h-full bg-primary transition-all rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
