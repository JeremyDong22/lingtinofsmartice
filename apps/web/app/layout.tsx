// Root Layout
// v1.2 - Added SWRProvider for stale-while-revalidate caching

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { SWRProvider } from '@/contexts/SWRProvider';

export const metadata: Metadata = {
  title: 'Lingtin 桌访管理',
  description: '智能桌访录音与数据分析系统',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lingtin',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#dc2626',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <AuthProvider>
          <SWRProvider>{children}</SWRProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
