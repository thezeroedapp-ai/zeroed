import { cn } from '@/lib/utils';

interface WidgetProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface WidgetHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  badge?: string | number;
  className?: string;
}

export function Widget({ children, className, onClick }: WidgetProps) {
  return (
    <div
      className={cn(
        'bg-white/[0.04] dark:bg-white/[0.05]',
        'backdrop-blur-xl',
        'border border-white/[0.08] border-t-white/[0.15]',
        'shadow-[0_8px_30px_rgb(0,0,0,0.10)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]',
        'rounded-2xl p-6 lg:p-7 flex flex-col gap-5',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function WidgetHeader({ title, icon, action, badge, className }: WidgetHeaderProps) {
  return (
    <div className={cn('flex justify-between items-center', className)}>
      <div className="flex items-center gap-2">
        {icon != null && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        {badge != null && (
          <span className="text-[10px] font-medium text-muted-foreground bg-white/[0.06] rounded-full px-1.5 py-0.5 leading-none tabular-nums">
            {badge}
          </span>
        )}
      </div>
      {action != null && (
        <div className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          {action}
        </div>
      )}
    </div>
  );
}
