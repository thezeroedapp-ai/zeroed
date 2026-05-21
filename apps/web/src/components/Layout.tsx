import { ReactNode } from 'react';
import SideNav from './SideNav';
import BottomNav from './BottomNav';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <SideNav />
      <div className="app-main">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
