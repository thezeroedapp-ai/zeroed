import { ReactNode } from 'react';
import SideNav from './SideNav';
import BottomNav from './BottomNav';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SideNav />
      <main className="app-main min-h-dvh">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
