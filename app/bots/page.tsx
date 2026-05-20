'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Star, Heart, Search, ArrowLeft, Flag, Loader2, X } from 'lucide-react';

interface Bot {
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
  isFavorite: boolean;
}

interface Review {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  userName: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  text: 'Chat',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  speech: 'Speech',
  transcription: 'Transcription',
  document: 'Document',
  study: 'Study',
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          style={{ color: s <= (hover || value) ? '#F59E0B' : 'var(--ui-text-3)' }}
        >
          <Star size={14} fill={s <= (hover || value) ? '#F59E0B' : 'none'} />
        </button>
      ))}
    </div>
  );
}

function ReviewModal({
  botId, botName, onClose,
}: { botId: string; botName: string; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/bots/reviews?botId=${botId}`)
      .then((r) => r.json())
      .then(setReviews)
      .catch(() => {});
  }, [botId]);

  const submit = async () => {
    if (!rating) return;
    setLoading(true);
    await fetch('/api/bots/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId, rating, reviewText: text }),
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl flex flex-col gap-4 p-6"
        style={{ background: 'var(--ui-bg-sidebar)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ui-text-1)' }}>
            Reviews · {botName}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--ui-text-3)' }}><X size={16} /></button>
        </div>

        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--ui-bg-card)', border: '1px solid var(--ui-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--ui-text-2)' }}>Write a review</p>
          <StarRating value={rating} onChange={setRating} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your experience…"
            rows={3}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }}
          />
          <button
            onClick={submit}
            disabled={!rating || loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            Submit
          </button>
        </div>

        {reviews.length > 0 && (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl p-3 space-y-1" style={{ background: 'var(--ui-bg-card)', border: '1px solid var(--ui-border)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium" style={{ color: 'var(--ui-text-1)' }}>{r.userName}</p>
                  <StarRating value={r.rating} />
                </div>
                {r.reviewText && (
                  <p className="text-xs" style={{ color: 'var(--ui-text-2)' }}>{r.reviewText}</p>
                )}
              </div>
            ))}
          </div>
        )}
        {reviews.length === 0 && (
          <p className="text-xs text-center" style={{ color: 'var(--ui-text-3)' }}>No reviews yet</p>
        )}
      </div>
    </div>
  );
}

function ReportModal({ botId, onClose }: { botId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [desc, setDesc] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!reason) return;
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportedType: 'bot', reportedId: botId, reason, description: desc }),
    });
    setSent(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--ui-bg-sidebar)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>Report Bot</h3>
          <button onClick={onClose} style={{ color: 'var(--ui-text-3)' }}><X size={16} /></button>
        </div>
        {sent ? (
          <p className="text-sm text-center py-4" style={{ color: '#22C55E' }}>Reported. Thank you.</p>
        ) : (
          <>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }}
            >
              <option value="">Select reason…</option>
              <option value="harmful">Harmful / Dangerous</option>
              <option value="spam">Spam</option>
              <option value="misleading">Misleading</option>
              <option value="other">Other</option>
            </select>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="More details (optional)…"
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
              style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }}
            />
            <button
              onClick={submit}
              disabled={!reason}
              className="w-full py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
              style={{ background: '#EF4444' }}
            >
              Submit Report
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function BotCard({
  bot,
  onToggleFavorite,
  onOpenReviews,
  onReport,
  onChat,
}: {
  bot: Bot;
  onToggleFavorite: (id: string, current: boolean) => void;
  onOpenReviews: (bot: Bot) => void;
  onReport: (id: string) => void;
  onChat: (slug: string) => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--ui-bg-card)', border: '1px solid var(--ui-border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: 'var(--ui-bg-card-hover)' }}
          >
            {bot.avatarUrl ?? '🤖'}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>{bot.name}</p>
            {bot.category && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--ui-bg-card-hover)', color: 'var(--ui-text-3)' }}
              >
                {CATEGORY_LABELS[bot.category] ?? bot.category}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onToggleFavorite(bot.id, bot.isFavorite)}
          className="p-1.5 rounded-lg transition-colors shrink-0"
          style={{ color: bot.isFavorite ? '#EF4444' : 'var(--ui-text-3)' }}
          title={bot.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart size={14} fill={bot.isFavorite ? '#EF4444' : 'none'} />
        </button>
      </div>

      <p className="text-xs line-clamp-2" style={{ color: 'var(--ui-text-2)' }}>
        {bot.description ?? 'No description'}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--ui-text-3)' }}>
          <span>{bot.usageCount} uses</span>
          <button
            onClick={() => onOpenReviews(bot)}
            className="flex items-center gap-1 hover:underline"
          >
            <Star size={11} fill="#F59E0B" style={{ color: '#F59E0B' }} />
            {bot.likeCount}
          </button>
          <button onClick={() => onReport(bot.id)} title="Report" className="hover:text-red-400">
            <Flag size={11} />
          </button>
        </div>
        <button
          onClick={() => onChat(bot.slug)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}
        >
          Chat
        </button>
      </div>
    </div>
  );
}

export default function BotsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [reviewBot, setReviewBot] = useState<Bot | null>(null);
  const [reportBotId, setReportBotId] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/bots');
    const data = await res.json();
    setBots(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBots(); }, [loadBots]);

  const toggleFavorite = async (botId: string, current: boolean) => {
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    setBots((prev) => prev.map((b) => b.id === botId ? { ...b, isFavorite: !current } : b));
    await fetch('/api/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId, action: current ? 'unfavorite' : 'favorite' }),
    });
  };

  const q = search.toLowerCase();
  const categories = [...new Set(bots.map((b) => b.category).filter(Boolean))] as string[];

  const filtered = bots.filter((b) => {
    if (showFavoritesOnly && !b.isFavorite) return false;
    if (activeCategory && b.category !== activeCategory) return false;
    if (q && !b.name.toLowerCase().includes(q) && !(b.description ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--ui-bg)', color: 'var(--ui-text-1)' }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/chat')}
            className="p-2 rounded-xl transition-colors"
            style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--ui-text-1)' }}>Bot Marketplace</h1>
            <p className="text-sm" style={{ color: 'var(--ui-text-3)' }}>Discover and favorite AI bots</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: 'var(--ui-bg-card)', border: '1px solid var(--ui-border)' }}
          >
            <Search size={13} style={{ color: 'var(--ui-text-3)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bots…"
              className="bg-transparent outline-none text-sm"
              style={{ color: 'var(--ui-text-1)', width: '160px' }}
            />
          </div>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors"
            style={{
              background: showFavoritesOnly ? 'rgba(239,68,68,0.15)' : 'var(--ui-bg-card)',
              border: `1px solid ${showFavoritesOnly ? '#EF4444' : 'var(--ui-border)'}`,
              color: showFavoritesOnly ? '#EF4444' : 'var(--ui-text-2)',
            }}
          >
            <Heart size={13} fill={showFavoritesOnly ? '#EF4444' : 'none'} />
            Favorites
          </button>

          <button
            onClick={() => setActiveCategory(null)}
            className="px-4 py-2 rounded-xl text-sm transition-colors"
            style={{
              background: !activeCategory ? 'var(--ui-bg-card-hover)' : 'var(--ui-bg-card)',
              border: `1px solid ${!activeCategory ? 'var(--ui-input-border)' : 'var(--ui-border)'}`,
              color: !activeCategory ? 'var(--ui-text-1)' : 'var(--ui-text-2)',
            }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className="px-4 py-2 rounded-xl text-sm transition-colors"
              style={{
                background: activeCategory === cat ? 'var(--ui-bg-card-hover)' : 'var(--ui-bg-card)',
                border: `1px solid ${activeCategory === cat ? 'var(--ui-input-border)' : 'var(--ui-border)'}`,
                color: activeCategory === cat ? 'var(--ui-text-1)' : 'var(--ui-text-2)',
              }}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ui-text-3)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--ui-text-3)' }}>
            {showFavoritesOnly ? 'No favorites yet. Click ♥ on a bot to favorite it.' : 'No bots found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onToggleFavorite={toggleFavorite}
                onOpenReviews={setReviewBot}
                onReport={setReportBotId}
                onChat={(slug) => router.push(`/chat/${slug}`)}
              />
            ))}
          </div>
        )}
      </div>

      {reviewBot && (
        <ReviewModal
          botId={reviewBot.id}
          botName={reviewBot.name}
          onClose={() => { setReviewBot(null); loadBots(); }}
        />
      )}
      {reportBotId && (
        <ReportModal botId={reportBotId} onClose={() => setReportBotId(null)} />
      )}
    </div>
  );
}
