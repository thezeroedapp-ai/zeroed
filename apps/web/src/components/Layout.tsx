import { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import SideNav from './SideNav';
import BottomNav from './BottomNav';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <SideNav />
      <main className="md:ml-[68px] lg:ml-[220px] min-h-dvh bg-background">
        {children}
      </main>
      <BottomNav />
    </TooltipProvider>
  );
}
