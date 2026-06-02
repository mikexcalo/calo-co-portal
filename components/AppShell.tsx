'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBarePage = pathname === '/login' || pathname === '/welcome';

  if (isBarePage) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
