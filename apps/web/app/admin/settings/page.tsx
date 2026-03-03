// Admin Settings Page - Hotword vocabulary management
// v1.0

'use client';

import { useRouter } from 'next/navigation';
import { UserMenu } from '@/components/layout/UserMenu';
import { HotwordManager } from '@/components/admin/HotwordManager';

export default function AdminSettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">设置</h1>
        </div>
        <UserMenu />
      </header>

      {/* Content */}
      <div className="px-4 py-4">
        <HotwordManager />
      </div>
    </div>
  );
}
