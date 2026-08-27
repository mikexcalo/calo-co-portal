import type { Metadata } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/lib/theme';
import { AppShell } from '@/components/AppShell';
import { OrgProvider } from '@/lib/spine/org';
import { TutorialProvider } from '@/lib/spine/tutorial';

export const metadata: Metadata = {
  title: 'Nautilus',
  description: 'Nautilus — run the work, bill the work.',
  icons: { icon: '/favicon.svg' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body
        style={{
          margin: 0,
          background: '#F7F7F5',
          color: '#1A1A1A',
          fontFamily: 'inherit',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <ThemeProvider>
          <OrgProvider>
            <TutorialProvider>
              <AppShell>{children}</AppShell>
            </TutorialProvider>
          </OrgProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
