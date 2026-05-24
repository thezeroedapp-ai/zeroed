import { NavLink } from 'react-router-dom';
import {
  Home, Target, CreditCard, TrendingUp, Settings, Shield, Sun, Moon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV = [
  { to: '/',         label: 'Home',     Icon: Home,       end: true  },
  { to: '/plan',     label: 'Plan',     Icon: Target,     end: false },
  { to: '/accounts', label: 'Accounts', Icon: CreditCard, end: false },
  { to: '/spending', label: 'Spending', Icon: TrendingUp, end: false },
  { to: '/settings', label: 'Settings', Icon: Settings,   end: false },
];

function UserAvatar({ initial, size = 28 }: { initial: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--primary)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: Math.round(size * 0.42),
        fontWeight: 700, color: 'white', flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

export default function SideNav() {
  const { profile, user } = useAuth();
  const { theme, toggle } = useTheme();

  const displayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const email       = profile?.email || user?.email || '';
  const initial     = displayName.charAt(0).toUpperCase();

  const itemClass = (isActive: boolean) => cn(
    'flex items-center justify-center lg:justify-start gap-3',
    'w-11 h-11 lg:w-full lg:h-auto lg:px-3 lg:py-3 rounded-lg',
    'text-sm font-medium transition-colors no-underline',
    isActive ? 'nav-active' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
  );

  return (
    <nav className={cn(
      'hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-50',
      'side-nav border-r border-border',
      'w-[68px] lg:w-[224px]',
      'pt-5 pb-4 gap-1',
      'items-center lg:items-stretch px-2 lg:px-3',
    )}>
      {/* Logo */}
      <div className="gradient-text font-extrabold tracking-tight mb-6 px-1 text-center lg:text-left">
        <span className="text-2xl lg:hidden">Z</span>
        <span className="hidden lg:block text-3xl">Zeroed</span>
      </div>

      {NAV.map(({ to, label, Icon, end }) => (
        <Tooltip key={to}>
          <TooltipTrigger asChild>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => itemClass(isActive)}
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

      {/* Spacer */}
      <div className="flex-1" />

      {profile?.is_admin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink
              to="/admin"
              className={({ isActive }) => itemClass(isActive)}
            >
              <Shield size={18} strokeWidth={1.75} className="shrink-0" />
              <span className="hidden lg:block">Admin</span>
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden bg-card border-border text-foreground">Admin</TooltipContent>
        </Tooltip>
      )}

      {/* User profile */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center lg:justify-start gap-2.5 px-1 lg:px-2 py-2.5 mt-1 rounded-lg cursor-default">
            <UserAvatar initial={initial} size={28} />
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{email}</p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="lg:hidden bg-card border-border text-foreground">
          {displayName}
        </TooltipContent>
      </Tooltip>

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggle}
            className={cn(
              'flex items-center justify-center lg:justify-start gap-3',
              'w-11 h-10 lg:w-full lg:h-auto lg:px-3 lg:py-2.5 rounded-lg',
              'text-sm font-medium transition-colors cursor-pointer',
              'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
            )}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark'
              ? <Sun size={18} strokeWidth={1.75} className="shrink-0" />
              : <Moon size={18} strokeWidth={1.75} className="shrink-0" />
            }
            <span className="hidden lg:block">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="lg:hidden bg-card border-border text-foreground">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </TooltipContent>
      </Tooltip>
    </nav>
  );
}
