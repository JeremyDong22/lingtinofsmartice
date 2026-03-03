// Chef Layout - Layout with bottom navigation for head_chef role
// v1.1 - Added usePrefetchData to warm SWR cache on app entry

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChefBottomNav } from '@/components/layout/ChefBottomNav';
import { WhatsNewModal } from '@/components/layout/WhatsNewModal';
import { usePrefetchData } from '@/hooks/usePrefetchData';

export default function ChefLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) return; // AuthContext handles redirect to /login
    if (user.roleCode !== 'head_chef' && user.roleCode !== 'chef') {
      // Redirect to their own home page
      if (user.roleCode === 'administrator') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/recorder');
      }
    }
  }, [user, isLoading, router]);

  usePrefetchData('chef');

  // Don't render chef pages for wrong role
  if (isLoading || !user || (user.roleCode !== 'head_chef' && user.roleCode !== 'chef')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {children}
      <ChefBottomNav />
      <WhatsNewModal />
    </div>
  );
}
