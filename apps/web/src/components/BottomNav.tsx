import { NavLink } from 'react-router-dom';
import { Home, Target, CreditCard, TrendingUp, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/',         label: 'Home',     Icon: Home,       end: true  },
  { to: '/plan',     label: 'Plan',     Icon: Target,     end: false },
  { to: '/accounts', label: 'Accounts', Icon: CreditCard, end: false },
  { to: '/spending', label: 'Spending', Icon: TrendingUp, end: false },
  { to: '/settings', label: 'Settings', Icon: Settings,   end: false },
];

export default function BottomNav() {
  return (
    <nav className={cn(
      'md:hidden fixed bottom-0 left-0 right-0 z-50 h-[60px]',
      'bottom-nav border-t border-border',
      'flex items-center justify-around px-1',
    )}>
      {NAV.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn(
            'flex flex-col items-center gap-0.5 px-3 py-2 flex-1',
            'text-[9px] font-medium no-underline transition-colors',
            isActive ? 'text-violet-light' : 'text-muted-foreground',
          )}
        >
          <Icon size={20} strokeWidth={1.75} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
