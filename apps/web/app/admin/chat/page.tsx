// Admin Chat Page - AI assistant for boss/administrator role
// v3.1 - Added i18n support

'use client';

import ChatPage from '@/components/chat/ChatPage';
import { useT } from '@/lib/i18n';

export default function AdminChatPage() {
  const { t } = useT();
  return (
    <ChatPage
      config={{
        role: 'admin',
        headerTitle: t('chat.admin.title'),
        placeholder: t('chat.admin.placeholder'),
        chatBasePath: '/admin/chat',
        fallbackQuickQuestions: [
          t('chat.admin.q1'),
          t('chat.admin.q2'),
          t('chat.admin.q3'),
          t('chat.admin.q4'),
        ],
        actionLinks: [
          { label: t('chat.admin.link1'), path: '/admin/briefing' },
          { label: t('chat.admin.link2'), path: '/admin/insights' },
        ],
        welcomeMessage: {
          title: t('chat.admin.welcomeTitle'),
          subtitle: t('chat.admin.welcomeSubtitle'),
          capabilities: [
            { icon: 'BarChart3', text: t('chat.admin.cap1') },
            { icon: 'ListTodo', text: t('chat.admin.cap2') },
            { icon: 'CheckCircle', text: t('chat.admin.cap3') },
          ],
        },
      }}
    />
  );
}
