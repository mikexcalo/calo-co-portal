import type { Metadata } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

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
      <body style={{ margin: 0, color: '#f5f5f5' }}>
        <div style={{ display: 'flex', height: '100vh' }}>
          <Sidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <TopBar />
            <main style={{ flex: 1, overflow: 'auto', background: '#0a0a0b' }}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
