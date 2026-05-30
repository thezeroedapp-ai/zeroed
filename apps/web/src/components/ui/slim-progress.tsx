import { cn } from '@/lib/utils';

interface SlimProgressProps {
  value: number;
  label?: string;
  sublabel?: string;
  colorClass?: string;
  className?: string;
}

export function SlimProgress({
  value,
  label,
  sublabel,
  colorClass = 'bg-primary',
  className,
}: SlimProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full', className)}>
      {(label != null || sublabel != null) && (
        <div className="flex justify-between text-[11px] font-medium text-gray-400 mb-1.5">
          {label != null && <span>{label}</span>}
          {sublabel != null && <span>{sublabel}</span>}
        </div>
      )}
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
