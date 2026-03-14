// Error Boundary for (main) route group
// Shows friendly error message with reload button instead of generic "Application error"

'use client';

import { useEffect } from 'react';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Lingtin] Route error:', error);
  }, [error]);

  const handleClearAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
    } catch {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">😵</p>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">页面加载出错</h2>
        <p className="text-sm text-gray-500 mb-6">
          可能是网络波动或缓存问题，请尝试刷新页面。
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full py-3 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 active:scale-[0.98] transition-all"
          >
            重试
          </button>
          <button
            onClick={handleClearAndReload}
            className="w-full py-3 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
          >
            清除缓存并刷新
          </button>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-300 mt-4">错误代码: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
