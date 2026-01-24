// Main App Layout - Layout with bottom navigation
// v1.0

import { BottomNav } from '@/components/layout/BottomNav';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-16">
      {children}
      <BottomNav />
    </div>
  );
}
