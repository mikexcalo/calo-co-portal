import type { Metadata } from 'next';
import './globals.css';
/**
 * Inter, variable — the face Polymarket runs, loaded the same way they do.
 * Geist Mono for figures, so columns of money line up and a reference code
 * cannot be mistaken for prose.
 */
import { Inter } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});
import { ThemeProvider } from '@/lib/theme';
import { AppShell } from '@/components/AppShell';
import { OrgProvider } from '@/lib/spine/org';
import { TutorialProvider } from '@/lib/spine/tutorial';
import { PRODUCT } from '@/lib/brand';

export const metadata: Metadata = {
  title: PRODUCT,
  description: `${PRODUCT} — run the work, bill the work.`,
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
    <html lang="en" className={inter.className}>
      <body
        style={{
          margin: 0,
          background: '#FFFFFF',
          color: '#1D1F24',
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
