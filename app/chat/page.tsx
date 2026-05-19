'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { ProviderRail } from '@/components/ProviderRail';
import { Conversation } from '@/lib/history';
import { Category, getCategoryInfo, getDefaultModelId } from '@/lib/models';
import { getCategoryTheme } from '@/lib/providerThemes';
import { useAccent } from '@/lib/accent';

export default function ChatPage() {
  const { data: session } = useSession();
  const userId = session?.user?.email ?? '';

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [category, setCategory] = useState<Category>('text');
  const accentHex = useAccent();

  const handleSelectConversation = (conv: Conversation) => {
    setConversation(conv);
    // Map legacy provider values to categories
    const legacyToCategory: Record<string, Category> = {
      gemini: 'text', deepseek: 'text', qwen: 'text',
    };
    const cat = (conv.provider ?? 'text') as Category;
    setCategory(legacyToCategory[cat] ?? cat);
  };

  const handleCategoryChange = (c: Category) => {
    setCategory(c);
    setConversation(null);
  };

  const catColor = getCategoryInfo(category)?.color ?? '#3B82F6';
  const theme = getCategoryTheme(catColor, accentHex);

  return (
    <div className="flex h-full">
      <ProviderRail active={category} onSelect={handleCategoryChange} />
      <ChatSidebar
        activeId={conversation?.id}
        userId={userId}
        onSelect={handleSelectConversation}
        onNew={() => setConversation(null)}
      />
      <main
        className="flex-1 min-w-0"
        style={{
          background: `linear-gradient(${theme.chatBgTint}, ${theme.chatBgTint}), var(--ui-bg-main)`,
        }}
      >
        <ChatWindow
          key={`${category}-${conversation?.id ?? 'new'}`}
          conversation={conversation}
          category={category}
          defaultModelId={getDefaultModelId(category)}
          onConversationUpdate={setConversation}
        />
      </main>
    </div>
  );
}
