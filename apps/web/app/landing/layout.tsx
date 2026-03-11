// Landing Page Layout - OG tags for WeChat sharing

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmartIce — 餐饮经营智能决策中枢',
  description: '当行业还在用表格管理门店，SmartIce 已经构建了自主学习、自主决策、自主验证的 AI Agent 架构。重新定义餐饮运营范式。',
  openGraph: {
    title: 'SmartIce — 餐饮经营智能决策中枢',
    description: '当行业还在用表格管理门店，SmartIce 已经构建了自主学习、自主决策、自主验证的 AI Agent 架构。重新定义餐饮运营范式。',
    url: 'https://lt.smartice.ai/landing',
    siteName: 'SmartIce',
    images: [
      {
        url: 'https://lt.smartice.ai/og-landing.png',
        width: 1200,
        height: 630,
        alt: 'SmartIce — AI 赋能餐饮经营',
      },
    ],
    locale: 'zh_CN',
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
