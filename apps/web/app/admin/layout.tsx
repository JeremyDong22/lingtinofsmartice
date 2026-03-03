// Admin Layout - Layout with bottom navigation for boss/administrator role
// v1.3 - Added usePrefetchData to warm SWR cache on app entry

'use client';

import { AdminBottomNav } from '@/components/layout/AdminBottomNav';
import { WhatsNewModal } from '@/components/layout/WhatsNewModal';
import { usePrefetchData } from '@/hooks/usePrefetchData';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  usePrefetchData('admin');

  return (
    <div className="min-h-screen pb-16">
      {children}
      <AdminBottomNav />
      <WhatsNewModal />
    </div>
  );
}
