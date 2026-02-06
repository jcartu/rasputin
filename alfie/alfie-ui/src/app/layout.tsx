import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { I18nProvider } from '@/components/shared/I18nProvider';
import { AccessibilityProvider } from '@/components/shared/AccessibilityProvider';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'ALFIE - AI Assistant',
  description: 'OpenClaw + MANUS powered AI assistant with advanced reasoning and tool execution',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AccessibilityProvider>
            <I18nProvider>{children}</I18nProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
