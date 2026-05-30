import { ReactNode } from 'react';
import SideNav from './SideNav';
import BottomNav from './BottomNav';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Ambient background — fixed behind everything */}
      <div className="fixed inset-0 -z-10 bg-background">
        <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-5%,oklch(0.28_0.12_264_/_22%),transparent)]" />
      </div>

      <SideNav />
      <main className="app-main min-h-dvh">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
