import type { Metadata } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'CALO&CO Portal',
  description: 'CALO&CO Agency Management Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body style={{ margin: 0, background: '#111113', color: '#f5f5f5', fontFamily: 'inherit' }}>
        <ThemeProvider>
          <div style={{ display: 'flex', height: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <TopBar />
              <main style={{ flex: 1, overflow: 'auto' }}>
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
