
import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
// Validate runtime environment variables on server startup
import '@/lib/env'
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SentryInit from '@/components/SentryInit'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'QuantumSage - Advanced AI Trading System',
  description: 'Advanced AI Forex & Multi-Asset Trading System by QuantumSage',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.variable} antialiased font-sans`}>
        <TooltipProvider>
          <SentryInit />
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
