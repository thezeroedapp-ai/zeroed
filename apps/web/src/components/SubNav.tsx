import { cn } from '@/lib/utils';

interface SubNavTab { id: string; label: string; }

export default function SubNav({ tabs, active, onChange }: {
  tabs: SubNavTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="pills py-3 -mx-4 px-4 border-b border-border mb-4">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border',
            'cursor-pointer font-[inherit]',
            id === active
              ? 'bg-violet-dim border-[var(--primary)] text-violet-light'
              : 'bg-card border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
