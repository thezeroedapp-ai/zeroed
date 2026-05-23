import { NavLink } from 'react-router-dom';
import {
  Home, Target, CreditCard, TrendingUp, Settings, Shield,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/',         label: 'Home',     Icon: Home,       end: true  },
  { to: '/plan',     label: 'Plan',     Icon: Target,     end: false },
  { to: '/accounts', label: 'Accounts', Icon: CreditCard, end: false },
  { to: '/spending', label: 'Spending', Icon: TrendingUp, end: false },
  { to: '/settings', label: 'Settings', Icon: Settings,   end: false },
];

export default function SideNav() {
  const { profile } = useAuth();

  return (
    <nav className={cn(
      'hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-50',
      'bg-[var(--nav-bg)] border-r border-border',
      'w-[68px] lg:w-[220px]',
      'pt-5 pb-4 gap-1',
      'items-center lg:items-stretch px-2 lg:px-3',
    )}>
      {/* Logo */}
      <div className="gradient-text font-extrabold tracking-tight mb-5 px-1 lg:px-1 text-center lg:text-left">
        <span className="text-2xl lg:hidden">Z</span>
        <span className="hidden lg:block text-2xl">Zeroed</span>
      </div>

      {NAV.map(({ to, label, Icon, end }) => (
        <Tooltip key={to}>
          <TooltipTrigger asChild>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'flex items-center justify-center lg:justify-start gap-3',
                'w-10 h-10 lg:w-full lg:h-auto lg:px-3 lg:py-2.5 rounded-lg',
                'text-[13px] font-medium transition-colors no-underline',
                isActive
                  ? 'bg-violet-dim text-violet-light'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
              )}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden bg-card border-border text-foreground">
            {label}
          </TooltipContent>
        </Tooltip>
      ))}

      {profile?.is_admin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                'flex items-center justify-center lg:justify-start gap-3 mt-auto',
                'w-10 h-10 lg:w-full lg:h-auto lg:px-3 lg:py-2.5 rounded-lg',
                'text-[13px] font-medium transition-colors no-underline',
                isActive
                  ? 'bg-violet-dim text-violet-light'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
              )}
            >
              <Shield size={18} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden lg:block">Admin</span>
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden bg-card border-border text-foreground">Admin</TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}
