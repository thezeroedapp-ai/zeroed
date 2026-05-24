import React from 'react';
import { Tooltip as MantineTooltip } from '@mantine/core';
import { cn } from '@/lib/utils';

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function TooltipTrigger({ children, asChild, className, ...props }: React.ComponentProps<'span'> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) return children;
  return <span className={cn(className)} {...props}>{children}</span>;
}

export function TooltipContent(_props: React.ComponentProps<'div'>) {
  return null;
}

export { MantineTooltip as MantineTooltipPrimitive };
