'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatWindow } from '@/components/ChatWindow';
import { Category, getDefaultModelId } from '@/lib/models';
import { ArrowLeft } from 'lucide-react';

interface BotInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  category: string | null;
  isSystemBot: boolean;
  usageCount: number;
  likeCount: number;
  tags: string[];
}

export default function BotChatPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/bots/${botId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setNotFound(true); } else { setBot(data); }
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [botId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--ui-text-3)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--ui-border)', borderTopColor: 'transparent' }} />
          <span className="text-sm">Loading bot…</span>
        </div>
      </div>
    );
  }

  if (notFound || !bot) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--ui-text-3)' }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs px-4">
          <span className="text-4xl">🤖</span>
          <p className="text-sm">Bot not found or no longer available.</p>
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-colors"
            style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)' }}
          >
            <ArrowLeft size={14} />
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  const category = (bot.category as Category) ?? 'text';

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ background: 'var(--ui-bg-sidebar)', borderColor: 'var(--ui-border)' }}>
        <button
          onClick={() => router.push('/chat')}
          className="p-1.5 rounded-lg transition-colors shrink-0"
          style={{ color: 'var(--ui-text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}
          title="Back to chat"
        >
          <ArrowLeft size={15} />
        </button>
        {bot.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bot.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: 'var(--ui-bg-card)' }}>
            🤖
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--ui-text-1)' }}>{bot.name}</p>
          {bot.description && (
            <p className="text-xs truncate" style={{ color: 'var(--ui-text-3)' }}>{bot.description}</p>
          )}
        </div>
        {bot.isSystemBot && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-3)' }}>
            Official
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ChatWindow
          conversation={null}
          category={category}
          defaultModelId={getDefaultModelId(category)}
          onConversationUpdate={() => {}}
          botSlug={bot.slug}
        />
      </div>
    </div>
  );
}
