// Admin Layout - Layout with bottom navigation for boss/administrator role
// v1.1 - Added 'use client' to fix Server/Client component boundary issue

'use client';

import { AdminBottomNav } from '@/components/layout/AdminBottomNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-16">
      {children}
      <AdminBottomNav />
    </div>
  );
}
