// Store Manager Chat Page - AI assistant for store managers
// v4.1 - Added i18n support

'use client';

import ChatPage from '@/components/chat/ChatPage';
import { useT } from '@/lib/i18n';

export default function ManagerChatPage() {
  const { t } = useT();
  return (
    <ChatPage
      config={{
        role: 'manager',
        headerTitle: t('chat.manager.title'),
        placeholder: t('chat.manager.placeholder'),
        chatBasePath: '/chat',
        fallbackQuickQuestions: [
          t('chat.manager.q1'),
          t('chat.manager.q2'),
          t('chat.manager.q3'),
          t('chat.manager.q4'),
        ],
        actionLinks: [
          { label: t('chat.manager.link1'), path: '/recorder' },
          { label: t('chat.manager.link2'), path: '/dashboard' },
        ],
        welcomeMessage: {
          title: t('chat.manager.welcomeTitle'),
          subtitle: t('chat.manager.welcomeSubtitle'),
          capabilities: [
            { icon: 'Search', text: t('chat.manager.cap1') },
            { icon: 'ListTodo', text: t('chat.manager.cap2') },
            { icon: 'CheckCircle', text: t('chat.manager.cap3') },
          ],
        },
      }}
    />
  );
}
