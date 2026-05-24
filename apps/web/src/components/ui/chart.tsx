import { ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<string, {
  label?: React.ReactNode;
  color?: string;
}>;

export function ChartContainer({
  className,
  children,
  config: _config,
}: {
  className?: string;
  children: React.ReactElement;
  config?: ChartConfig;
}) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export const ChartTooltip = Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  formatter,
}: {
  active?: boolean;
  payload?: { value: unknown; name: string; color?: string; dataKey?: string }[];
  formatter?: (value: unknown, name: string, item: unknown, index: number, payload: unknown) => [React.ReactNode, string];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs shadow-xl">
      {payload.map((item, i) => {
        const [val, name] = formatter
          ? formatter(item.value, item.name, item, i, item)
          : [item.value, item.name];
        return (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-muted-foreground">{name}:</span>
            <span className="font-medium tabular text-foreground">{val as React.ReactNode}</span>
          </div>
        );
      })}
    </div>
  );
}
