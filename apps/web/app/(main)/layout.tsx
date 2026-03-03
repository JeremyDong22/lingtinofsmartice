// Main App Layout - Layout with bottom navigation
// v1.3 - Added usePrefetchData to warm SWR cache on app entry

'use client';

import { BottomNav } from '@/components/layout/BottomNav';
import { WhatsNewModal } from '@/components/layout/WhatsNewModal';
import { usePrefetchData } from '@/hooks/usePrefetchData';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  usePrefetchData('manager');

  return (
    <div className="min-h-screen pb-16">
      {children}
      <BottomNav />
      <WhatsNewModal />
    </div>
  );
}
