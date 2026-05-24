import React, { createContext, useContext } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectCtx {
  value?: string;
  onChange: (v: string) => void;
}
const Ctx = createContext<SelectCtx>({ onChange: () => {} });

export function Select({
  value,
  defaultValue,
  onValueChange,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ value: value ?? defaultValue, onChange: (v) => onValueChange?.(v) }}>
      {children}
    </Ctx.Provider>
  );
}

// SelectTrigger and SelectValue are invisible — SelectContent renders the actual <select>
export function SelectTrigger({ children }: { className?: string; children?: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectValue(_props: { placeholder?: string }) {
  return null;
}

export function SelectContent({ children, className }: { children?: React.ReactNode; className?: string }) {
  const { value, onChange } = useContext(Ctx);
  return (
    <div className="relative w-full">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full h-9 appearance-none rounded-md border border-border bg-input px-3 pr-8 py-1 text-sm',
          'text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30',
          'disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export function SelectItem({ value, children, disabled }: { value: string; children?: React.ReactNode; disabled?: boolean }) {
  return <option value={value} disabled={disabled}>{children}</option>;
}

export function SelectGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
