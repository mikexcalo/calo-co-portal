import { Inter } from 'next/font/google';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import '@/app/globals.css';

const inter = Inter({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
});

export const metadata = {
  title: 'CALO&CO — Portal',
  description: 'Agency management portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#f1f5f9] text-[#0f172a] min-h-screen`}>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
