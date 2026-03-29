import type { Metadata } from 'next';
import './globals.css';

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
      <body style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
