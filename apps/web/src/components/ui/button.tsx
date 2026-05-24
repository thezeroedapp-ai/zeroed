import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'link' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
  asChild?: boolean;
}

export function Button({ className, variant = 'default', size = 'default', asChild, children, ...props }: ButtonProps) {
  const cls = cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
    variant === 'default'     && 'bg-primary text-primary-foreground hover:bg-primary/90',
    variant === 'outline'     && 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
    variant === 'ghost'       && 'hover:bg-accent hover:text-accent-foreground',
    variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/90',
    variant === 'link'        && 'text-primary underline-offset-4 hover:underline',
    variant === 'secondary'   && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    size === 'default' && 'h-9 px-4 py-2',
    size === 'sm'      && 'h-8 px-3 text-xs',
    size === 'lg'      && 'h-10 px-6',
    size === 'icon'    && 'h-9 w-9',
    size === 'xs'      && 'h-6 px-2 text-xs',
    className,
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      className: cn(cls, (children as React.ReactElement<any>).props.className),
    });
  }

  return <button className={cls} {...props}>{children}</button>;
}
