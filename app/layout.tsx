import type { Metadata } from 'next';
import './globals.css';
import GlobalNav from '@/components/layout/GlobalNav';

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
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
        <GlobalNav />
        <div style={{ minHeight: 'calc(100vh - 56px - 48px)' }}>
          {children}
        </div>
        <footer
          style={{
            textAlign: 'center',
            padding: '14px 0',
            fontSize: '11px',
            color: '#94a3b8',
            height: '48px',
          }}
        >
          <a
            href="https://mikecalo.co"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Powered by CALO&CO
          </a>
        </footer>
      </body>
    </html>
  );
}
