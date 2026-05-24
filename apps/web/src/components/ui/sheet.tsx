import React, { createContext, useContext } from 'react';
import { Drawer } from '@mantine/core';
import { cn } from '@/lib/utils';

interface SheetCtx {
  open: boolean;
  onClose: () => void;
}
const Ctx = createContext<SheetCtx>({ open: false, onClose: () => {} });

export function Sheet({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ open, onClose: () => onOpenChange?.(false) }}>
      {children}
    </Ctx.Provider>
  );
}

export function SheetContent({
  children,
  className,
  side = 'right',
}: {
  children?: React.ReactNode;
  className?: string;
  side?: 'right' | 'left' | 'top' | 'bottom';
}) {
  const { open, onClose } = useContext(Ctx);
  const position = side === 'right' ? 'right' : side === 'left' ? 'left' : side === 'top' ? 'top' : 'bottom';
  return (
    <Drawer
      opened={open}
      onClose={onClose}
      position={position}
      size="sm"
      withCloseButton={false}
      styles={{
        body: { padding: 0 },
        content: { backgroundColor: 'var(--card)', borderLeft: '1px solid var(--border)' },
        inner: { right: 0 },
      }}
    >
      <div className={cn('flex flex-col gap-4 p-6 h-full overflow-y-auto', className)}>
        {children}
      </div>
    </Drawer>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-semibold text-foreground', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-auto flex flex-col gap-2', className)} {...props} />;
}

export function SheetTrigger({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function SheetClose({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
