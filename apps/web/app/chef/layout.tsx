// Chef Layout - Layout with bottom navigation for head_chef role
// v1.2 - Fix: always render nav bar, only block content area during auth loading

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

  // Show loading skeleton in content area while auth resolves,
  // but always render the nav bar so it stays interactive
  const contentReady = !isLoading && !!user && (user.roleCode === 'head_chef' || user.roleCode === 'chef');

  return (
    <div className="min-h-screen pb-16">
      {contentReady ? children : (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-400 text-sm">加载中...</div>
        </div>
      )}
      <ChefBottomNav />
      <WhatsNewModal />
    </div>
  );
}
