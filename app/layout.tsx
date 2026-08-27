import type { Metadata } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { Source_Serif_4 } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme';
import { AppShell } from '@/components/AppShell';
import { OrgProvider } from '@/lib/spine/org';
import { TutorialProvider } from '@/lib/spine/tutorial';

/**
 * Headings only. A transitional serif in the Tiempos family does the
 * editorial work; the body stays in a neutral grotesque.
 */
const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

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
    <html lang="en" className={`${GeistSans.className} ${serif.variable}`}>
      <body
        style={{
          margin: 0,
          background: '#FAF9F7',
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
