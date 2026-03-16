import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Toaster } from 'sonner';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Zetrix Sign — Blockchain-Verified Document Signing',
  description: 'Sign and verify documents with blockchain-backed cryptographic proof on the Zetrix network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans flex min-h-screen flex-col`}>
        <Header />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
        <Toaster position="top-right" />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
