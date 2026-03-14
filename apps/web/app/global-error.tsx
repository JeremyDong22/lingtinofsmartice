// Global Error Boundary - Catches errors in the root layout itself
// This is the last line of defense before Next.js shows "Application error"

'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Lingtin] Global error:', error);
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
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '320px' }}>
            <p style={{ fontSize: '48px', margin: '0 0 16px' }}>😵</p>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 8px' }}>
              页面加载出错
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
              可能是网络波动或缓存问题，请尝试刷新页面。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => reset()}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#fff',
                  backgroundColor: '#3A3F62',
                  cursor: 'pointer',
                }}
              >
                重试
              </button>
              <button
                onClick={handleClearAndReload}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#4b5563',
                  backgroundColor: '#f3f4f6',
                  cursor: 'pointer',
                }}
              >
                清除缓存并刷新
              </button>
            </div>
            {error.digest && (
              <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '16px' }}>
                错误代码: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
