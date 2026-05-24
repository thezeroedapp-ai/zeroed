import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm',
        'text-foreground placeholder:text-muted-foreground',
        'outline-none focus:border-ring focus:ring-2 focus:ring-ring/30',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
