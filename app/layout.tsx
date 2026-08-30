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
  /**
   * The ampersand from calo.company, copied rather than redrawn — it is set
   * in Lora italic with the font embedded in the file, so any recreation
   * would be a near-miss that reads as slightly wrong beside the real site.
   */
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
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
