import type { Metadata } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/lib/theme';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Nautilus',
  description: 'Nautilus — Agency Management Portal',
  icons: { icon: '/favicon.svg' },
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
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
