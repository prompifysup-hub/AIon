'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sparkles, Plus, Trash2, MessageSquare, Search, Star, Settings, Bell, Coins, Store } from 'lucide-react';
import {
  getHistory, deleteConversation, toggleStarConversation,
  groupByDate, Conversation,
} from '@/lib/history';
import { SettingsModal } from './SettingsModal';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Props {
  activeId?: string;
  userId: string;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
}

interface ProfileData {
  displayName: string;
  avatar: string | null;
}

function loadProfile(fallbackName: string): ProfileData {
  return {
    displayName: localStorage.getItem('aion_display_name') || fallbackName,
    avatar: localStorage.getItem('aion_avatar'),
  };
}

export function ChatSidebar({ activeId, userId, onSelect, onNew }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const [allConvs, setAllConvs] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({ displayName: '', avatar: null });
  const [credits, setCredits] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const refreshProfile = useCallback(() => {
    const fallback = session?.user?.name || session?.user?.email || 'User';
    setProfile(loadProfile(fallback));
  }, [session]);

  const refresh = useCallback(async () => {
    const convs = await getHistory();
    setAllConvs(convs);
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch('/api/credits');
      const data = await res.json();
      if (data.loggedIn) setCredits(data.balance);
    } catch { /* ignore */ }
  }, [session]);

  const loadNotifications = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch { /* ignore */ }
  }, [session]);

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshCredits(); }, [refreshCredits]);
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    const handler = () => { refreshCredits(); };
    window.addEventListener('aion:credits', handler);
    return () => window.removeEventListener('aion:credits', handler);
  }, [refreshCredits]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  useEffect(() => {
    window.addEventListener('aion:history', refresh);
    return () => window.removeEventListener('aion:history', refresh);
  }, [refresh]);

  useEffect(() => {
    const handler = () => refreshProfile();
    window.addEventListener('aion:profile', handler);
    return () => window.removeEventListener('aion:profile', handler);
  }, [refreshProfile]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
    refresh();
  };

  const handleStar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleStarConversation(id);
    refresh();
  };

  const q = search.trim().toLowerCase();
  const starred = allConvs.filter((c) => c.starred && (!q || c.title.toLowerCase().includes(q)));
  const unstarred = allConvs.filter((c) => !c.starred && (!q || c.title.toLowerCase().includes(q)));
  const groups = groupByDate(unstarred);
  const noResults = q && starred.length === 0 && unstarred.length === 0;

  const initials = profile.displayName[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <>
      <aside
        className="w-64 flex flex-col h-screen shrink-0 border-r"
        style={{ background: 'var(--ui-bg-sidebar)', borderColor: 'var(--ui-border)' }}
      >
        {/* Logo + New chat */}
        <div className="px-3 py-4 border-b" style={{ borderColor: 'var(--ui-border)' }}>
          <div className="flex items-center justify-between px-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-white" />
              </div>
              <span className="font-semibold tracking-tight text-sm" style={{ color: 'var(--ui-text-1)' }}>
                AIon
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Marketplace */}
              <button
                onClick={() => router.push('/bots')}
                title="Bot Marketplace"
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--ui-text-3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}
              >
                <Store size={13} />
              </button>
              {/* Notifications */}
              {session && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifs(!showNotifs)}
                    title="Notifications"
                    className="p-1.5 rounded-lg transition-colors relative"
                    style={{ color: 'var(--ui-text-3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}
                  >
                    <Bell size={13} />
                    {notifications.some((n) => !n.isRead) && (
                      <span
                        className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                        style={{ background: '#EF4444' }}
                      />
                    )}
                  </button>
                  {showNotifs && (
                    <div
                      className="absolute left-0 top-full mt-1 w-72 rounded-xl overflow-hidden z-50 shadow-xl"
                      style={{ background: 'var(--ui-bg-sidebar)', border: '1px solid var(--ui-border)' }}
                    >
                      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--ui-border)' }}>
                        <span className="text-xs font-semibold" style={{ color: 'var(--ui-text-1)' }}>Notifications</span>
                        {notifications.some((n) => !n.isRead) && (
                          <button onClick={markAllRead} className="text-[10px]" style={{ color: 'var(--ui-text-3)' }}>
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-center py-6" style={{ color: 'var(--ui-text-3)' }}>No notifications</p>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className="px-3 py-2.5 border-b"
                              style={{
                                borderColor: 'var(--ui-border)',
                                background: n.isRead ? 'transparent' : 'rgba(139,92,246,0.06)',
                              }}
                            >
                              <p className="text-xs font-medium" style={{ color: 'var(--ui-text-1)' }}>{n.title}</p>
                              {n.body && <p className="text-[11px] mt-0.5" style={{ color: 'var(--ui-text-3)' }}>{n.body}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-colors"
            style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
          >
            <Plus size={15} />
            New chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-2.5 pb-1.5">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-border)' }}
          >
            <Search size={13} style={{ color: 'var(--ui-text-3)', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: 'var(--ui-text-1)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* History */}
        <nav className="flex-1 overflow-y-auto py-1 px-2">
          {starred.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--ui-text-3)' }}>
                Starred
              </p>
              {starred.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onSelect={onSelect}
                  onDelete={handleDelete}
                  onStar={handleStar}
                />
              ))}
            </div>
          )}

          {noResults && (
            <p className="text-center text-xs px-4 py-6" style={{ color: 'var(--ui-text-3)' }}>
              No results for &ldquo;{search}&rdquo;
            </p>
          )}

          {!q && allConvs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-xs gap-2" style={{ color: 'var(--ui-text-3)' }}>
              <MessageSquare size={18} className="opacity-40" />
              <span>No conversations yet</span>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--ui-text-3)' }}>
                {group.label}
              </p>
              {group.items.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onSelect={onSelect}
                  onDelete={handleDelete}
                  onStar={handleStar}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom: user + settings */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--ui-border)' }}>
          {session && credits !== null && (
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl mb-1 text-xs"
              style={{ color: credits <= 50 ? '#F59E0B' : 'var(--ui-text-3)' }}
              title={`${credits} credits remaining`}
            >
              <Coins size={12} />
              <span>{credits.toLocaleString()} credits</span>
              {credits <= 50 && <span className="text-[10px]">⚠ low</span>}
            </div>
          )}
          {session && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{
                  background: profile.avatar ? undefined : 'linear-gradient(135deg,#8B5CF6,#3B82F6)',
                }}
              >
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--ui-text-1)' }}>
                  {profile.displayName || session.user?.name || 'User'}
                </p>
              </div>

              {/* Settings gear */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-1 rounded-lg transition-colors"
                style={{ color: 'var(--ui-text-3)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--ui-bg-card)';
                  e.currentTarget.style.color = 'var(--ui-text-1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--ui-text-3)';
                }}
                title="Settings"
              >
                <Settings size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

function ConvItem({
  conv, active, onSelect, onDelete, onStar,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: (c: Conversation) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onStar: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(conv)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(conv)}
      className="group w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-left transition-colors mb-0.5 cursor-pointer"
      style={{
        background: active ? 'var(--ui-bg-card-hover)' : 'transparent',
        color: active ? 'var(--ui-text-1)' : 'var(--ui-text-2)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--ui-bg-card)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span className="flex-1 text-sm truncate">{conv.title}</span>

      {/* Star */}
      <button
        onClick={(e) => onStar(e, conv.id)}
        className={`shrink-0 p-0.5 rounded transition-all ${conv.starred ? '' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ color: conv.starred ? '#EAB308' : 'var(--ui-text-3)' }}
        onMouseEnter={(e) => !conv.starred && (e.currentTarget.style.color = '#EAB308')}
        onMouseLeave={(e) => !conv.starred && (e.currentTarget.style.color = 'var(--ui-text-3)')}
      >
        <Star size={12} fill={conv.starred ? '#EAB308' : 'none'} />
      </button>

      {/* Delete */}
      <button
        onClick={(e) => onDelete(e, conv.id)}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded transition-all"
        style={{ color: 'var(--ui-text-3)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ui-text-3)')}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
