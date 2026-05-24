import { cn } from '@/lib/utils';

export interface BadgeProps extends React.ComponentProps<'span'> {
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border',
        variant === 'default' && 'bg-primary text-primary-foreground border-transparent',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground border-transparent',
        variant === 'outline' && 'bg-transparent text-foreground border-border',
        variant === 'destructive' && 'bg-destructive text-white border-transparent',
        className,
      )}
      {...props}
    />
  );
}
