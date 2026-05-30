import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div
      className={cn(
        'w-full max-w-[2560px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16 py-8 min-h-screen',
        className,
      )}
    >
      {children}
    </div>
  );
}
