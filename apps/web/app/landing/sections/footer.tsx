'use client';

import { useState, useRef, useEffect } from 'react';

export function Footer() {
  return (
    <footer className="py-10 px-4 text-center border-t border-gray-100/50">
      <div className="text-sm text-gray-400 space-y-1">
        <p className="font-medium text-gray-500">SmartIce</p>
        <p>© {new Date().getFullYear()} SmartIce Technology. All rights reserved.</p>
        <p>Chengdu, China</p>
      </div>
    </footer>
  );
}

export function ShareButton({ onShare }: { onShare: () => void }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const setCopiedWithTimeout = (ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), ms);
  };

  const handleShare = async () => {
    onShare();

    const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    if (isWeChat) {
      setCopiedWithTimeout(3000);
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SmartIce - 餐饮经营的智能决策中枢',
          url: window.location.href,
        });
        return;
      } catch {
        // User cancelled or API failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedWithTimeout(2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <button
      onClick={handleShare}
      className="fixed z-50 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 flex items-center justify-center hover:bg-primary-700 transition-colors bottom-[calc(24px+env(safe-area-inset-bottom,0px))] right-[calc(16px+env(safe-area-inset-right,0px))]"
      aria-label="分享"
    >
      {copied ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
      )}
    </button>
  );
}
