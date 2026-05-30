import { cn } from '@/lib/utils';

interface DataRowProps {
  title: string;
  subtitle?: string;
  value: string;
  subValue?: string;
  valueClassName?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function DataRow({ title, subtitle, value, subValue, valueClassName, icon, className }: DataRowProps) {
  return (
    <div className={cn('flex justify-between items-center gap-4 group py-3', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon != null && (
          <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.06]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{title}</p>
          {subtitle != null && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-medium text-white tabular-nums', valueClassName)}>{value}</p>
        {subValue != null && (
          <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{subValue}</p>
        )}
      </div>
    </div>
  );
}
