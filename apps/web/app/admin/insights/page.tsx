// Admin Insights Page - Customer insights + Customer profile + Employee feedback
// Product insights accessible via URL param ?tab=product (superadmin only, hidden from tab bar)

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserMenu } from '@/components/layout/UserMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useManagedScope } from '@/hooks/useManagedScope';
import { CustomerInsights } from '@/components/admin/CustomerInsights';
import { ProductInsights } from '@/components/admin/ProductInsights';
import { CustomerProfile } from '@/components/admin/CustomerProfile';
import { FeedbackManagement } from '@/components/admin/FeedbackManagement';
import { getChinaYesterday, singleDay } from '@/lib/date-utils';
import type { DateRange } from '@/lib/date-utils';
import { DatePicker, adminPresets } from '@/components/shared/DatePicker';

type InsightTab = 'customer' | 'profile' | 'feedback' | 'product';

function InsightsContent() {
  const { user } = useAuth();
  const { managedIdsParam } = useManagedScope();
  const isSuperAdmin = user?.isSuperAdmin === true;
  const searchParams = useSearchParams();

  // Check URL for ?tab=product (hidden from tab bar, superadmin only)
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<InsightTab>(() => {
    if (urlTab === 'product' && isSuperAdmin) return 'product';
    return 'customer';
  });

  // React to URL param changes
  useEffect(() => {
    if (urlTab === 'product' && isSuperAdmin) {
      setActiveTab('product');
    }
  }, [urlTab, isSuperAdmin]);

  const [dateRange, setDateRange] = useState<DateRange>(() => singleDay(getChinaYesterday()));

  const showDatePicker = activeTab !== 'feedback';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-nav px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {activeTab === 'product' ? '产品洞察' : '洞察'}
        </h1>
        <div className="flex items-center gap-2">
          {showDatePicker && (
            <DatePicker
              value={dateRange}
              onChange={setDateRange}
              maxDate={getChinaYesterday()}
              presets={adminPresets}
            />
          )}
          <UserMenu />
        </div>
      </header>

      {/* Segmented Control — hide when showing product (URL-only) */}
      {activeTab !== 'product' && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'customer'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              顾客
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'profile'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              画像
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'feedback'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              员工反馈
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-3">
        {activeTab === 'customer' && <CustomerInsights startDate={dateRange.startDate} endDate={dateRange.endDate} managedIdsParam={managedIdsParam} />}
        {activeTab === 'profile' && <CustomerProfile startDate={dateRange.startDate} endDate={dateRange.endDate} managedIdsParam={managedIdsParam} />}
        {activeTab === 'product' && <ProductInsights />}
        {activeTab === 'feedback' && <FeedbackManagement />}
      </div>

      {/* Bottom spacing for nav */}
      <div className="h-4" />
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    }>
      <InsightsContent />
    </Suspense>
  );
}
