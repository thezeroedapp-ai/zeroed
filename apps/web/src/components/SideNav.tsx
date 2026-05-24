import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Target, CreditCard, TrendingUp,
  Settings, Shield, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MAIN_NAV = [
  { to: '/',         label: 'Dashboard', Icon: LayoutDashboard, end: true  },
  { to: '/plan',     label: 'Plan',      Icon: Target,          end: false },
  { to: '/accounts', label: 'Accounts',  Icon: CreditCard,      end: false },
  { to: '/spending', label: 'Spending',  Icon: TrendingUp,      end: false },
];

export default function SideNav() {
  const { profile, user } = useAuth();
  const { theme, toggle } = useTheme();

  const displayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const email       = profile?.email || user?.email || '';
  const initial     = displayName.charAt(0).toUpperCase();

  return (
    <nav
      style={{ width: 220 }}
      className="hidden md:flex flex-col fixed inset-y-0 left-0 z-50 side-nav border-r border-border"
    >

      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-border shrink-0">
        <span className="gradient-text font-extrabold text-[22px] leading-none select-none tracking-tight">
          Zeroed
        </span>
      </div>

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <div className="flex flex-col gap-0.5">
          {MAIN_NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full no-underline',
                'text-sm font-medium transition-colors duration-100',
                isActive
                  ? 'bg-foreground/[0.08] text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
              )}
            >
              <Icon size={17} strokeWidth={2} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-border py-3 px-3">

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full no-underline mb-0.5',
            'text-sm font-medium transition-colors duration-100',
            isActive
              ? 'bg-foreground/[0.08] text-foreground font-semibold'
              : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
          )}
        >
          <Settings size={17} strokeWidth={2} className="shrink-0" />
          Settings
        </NavLink>

        {profile?.is_admin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full no-underline mb-0.5',
              'text-sm font-medium transition-colors duration-100',
              isActive
                ? 'bg-foreground/[0.08] text-foreground font-semibold'
                : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
            )}
          >
            <Shield size={17} strokeWidth={2} className="shrink-0" />
            Admin
          </NavLink>
        )}

        {/* User */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-lg select-none cursor-default">
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white',
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-foreground truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{email}</p>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-xs font-medium text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors cursor-pointer mt-0.5"
        >
          {theme === 'dark'
            ? <Sun size={14} strokeWidth={2} className="shrink-0" />
            : <Moon size={14} strokeWidth={2} className="shrink-0" />
          }
          {theme === 'dark' ? 'Cream mode' : 'Charcoal mode'}
        </button>

      </div>
    </nav>
  );
}
