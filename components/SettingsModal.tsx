'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  X, User, Settings, HelpCircle, Sun, Moon, Upload,
  Bug, FileText, Shield, Headphones, Send, Loader2,
  Key, Building2, Plus, Trash2, Copy, Check, Users,
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { ACCENT_PRESETS, saveAccent } from '@/lib/accent';

interface Props {
  onClose: () => void;
}

type Tab = 'profile' | 'general' | 'keys' | 'orgs' | 'help';
type Dialog = null | 'help-center' | 'report-bug' | 'privacy' | 'tos';

// ─── Sub-dialog: contact form ────────────────────────────────────────────────
function ContactDialog({
  title,
  placeholder,
  type,
  onClose,
}: {
  title: string;
  placeholder: string;
  type: 'help' | 'bug';
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const send = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, type }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-2xl flex flex-col"
        style={{
          background: 'var(--ui-bg-sidebar)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          height: 'min(480px, calc(100vh - 2rem))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--ui-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--ui-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {status === 'sent' ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'rgba(34,197,94,0.15)' }}>✓</div>
              <p className="text-sm font-medium" style={{ color: 'var(--ui-text-1)' }}>Message sent!</p>
              <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
                We&rsquo;ll get back to you at <strong>aionagentic@gmail.com</strong>
              </p>
              <button onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ui-text-2)' }}>
                  Subject <span style={{ color: 'var(--ui-text-3)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What's this about?"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }}
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ui-text-2)' }}>
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{
                    background: 'var(--ui-input-bg)',
                    border: '1px solid var(--ui-input-border)',
                    color: 'var(--ui-text-1)',
                    minHeight: '140px',
                  }}
                />
              </div>
              {status === 'error' && (
                <p className="text-xs text-red-400">
                  Failed to send. Make sure GMAIL_APP_PASSWORD is set in .env.local
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {status !== 'sent' && (
          <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--ui-border)' }}>
            <button
              onClick={send}
              disabled={!message.trim() || status === 'sending'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}
              onMouseEnter={(e) => { if (message.trim()) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {status === 'sending' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-dialog: text/policy popup ───────────────────────────────────────────
function TextDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl flex flex-col"
        style={{
          background: 'var(--ui-bg-sidebar)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          height: 'min(560px, calc(100vh - 2rem))',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--ui-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--ui-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}>
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm space-y-4 leading-relaxed"
          style={{ color: 'var(--ui-text-2)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const PRIVACY_CONTENT = (
  <>
    <p style={{ color: 'var(--ui-text-3)', fontSize: '11px' }}>Last updated: May 2026</p>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>1. Information We Collect</h4>
      <p>AIon collects only the information necessary to provide our service. This includes your email address and display name when you create an account, and the content of conversations you have with AI models. We do not sell your personal data to third parties.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>2. How We Use Your Data</h4>
      <p>Your conversation history is stored locally in your browser using localStorage and is never uploaded to our servers unless you explicitly share it. Your account credentials are securely hashed and stored to authenticate you on future visits.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>3. Third-Party AI Providers</h4>
      <p>Messages you send are forwarded to third-party AI providers (Google Gemini, DeepSeek, Qwen/Alibaba) to generate responses. Please review their respective privacy policies. AIon does not store these messages on its own servers beyond what is required to process your request.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>4. Cookies &amp; Local Storage</h4>
      <p>AIon uses browser localStorage to remember your preferences (theme, accent color, conversation history). No cross-site tracking cookies are used. Session cookies are used solely for authentication.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>5. Your Rights</h4>
      <p>You may delete your conversation history at any time by clearing your browser data. To request account deletion or data export, contact us at aionagentic@gmail.com. We will respond within 30 days.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>6. Security</h4>
      <p>We use industry-standard security practices including bcrypt password hashing and HTTPS-only connections. However, no method of internet transmission is 100% secure and we cannot guarantee absolute security.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>7. Contact</h4>
      <p>For privacy-related questions, email us at <strong>aionagentic@gmail.com</strong>.</p>
    </section>
  </>
);

const TOS_CONTENT = (
  <>
    <p style={{ color: 'var(--ui-text-3)', fontSize: '11px' }}>Last updated: May 2026</p>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>1. Acceptance of Terms</h4>
      <p>By accessing or using AIon, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our service.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>2. Use of Service</h4>
      <p>AIon is provided for personal and commercial use. You agree not to use the service to generate illegal content, harass others, spread misinformation, or violate the terms of any third-party AI provider. You are responsible for all activity under your account.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>3. AI-Generated Content</h4>
      <p>Responses generated by AI models are not guaranteed to be accurate, complete, or suitable for any particular purpose. AIon makes no warranty regarding the quality or reliability of AI-generated content. Always verify important information from authoritative sources.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>4. Intellectual Property</h4>
      <p>The AIon application, including its design, code, and branding, is the intellectual property of AIon and its creators. AI-generated content in your conversations belongs to you, subject to the terms of the underlying AI providers.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>5. Account Termination</h4>
      <p>We reserve the right to suspend or terminate accounts that violate these terms, engage in abusive behaviour, or misuse the service. You may delete your account at any time by contacting us.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>6. Disclaimer of Warranties</h4>
      <p>AIon is provided &ldquo;as is&rdquo; without warranty of any kind. We do not warrant that the service will be uninterrupted, error-free, or free of harmful components. Your use of the service is at your sole risk.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>7. Changes to Terms</h4>
      <p>We may update these Terms of Service at any time. Continued use of AIon after changes constitutes your acceptance of the new terms. We will notify users of significant changes via email when possible.</p>
    </section>
    <section>
      <h4 className="font-semibold mb-1" style={{ color: 'var(--ui-text-1)' }}>8. Contact</h4>
      <p>For questions about these terms, email <strong>aionagentic@gmail.com</strong>.</p>
    </section>
  </>
);

// ─── Main settings modal ──────────────────────────────────────────────────────
export function SettingsModal({ onClose }: Props) {
  const { data: session } = useSession();
  const { isDark, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>('profile');
  const [dialog, setDialog] = useState<Dialog>(null);

  // Profile
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General
  const [accentColor, setAccentColor] = useState('#8B5CF6');
  const [customColor, setCustomColor] = useState('#8B5CF6');

  // API Keys
  interface ApiKey { id: string; name: string | null; keyPrefix: string; isActive: boolean; createdAt: string; lastUsedAt: string | null; }
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keysLoading, setKeysLoading] = useState(false);

  // Organizations
  interface Org { id: string; name: string; slug: string; memberCount: number; role: string; createdAt: string; }
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');

  useEffect(() => {
    setDisplayName(localStorage.getItem('aion_display_name') || session?.user?.name || '');
    setUsername(localStorage.getItem('aion_username') || session?.user?.email?.split('@')[0] || '');
    setAvatar(localStorage.getItem('aion_avatar'));
    const savedAccent = localStorage.getItem('aion_accent') || '#8B5CF6';
    setAccentColor(savedAccent);
    if (savedAccent !== 'rainbow') setCustomColor(savedAccent);
  }, [session]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (dialog) setDialog(null); else onClose(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, dialog]);

  const loadKeys = async () => {
    setKeysLoading(true);
    const res = await fetch('/api/keys');
    const data = await res.json();
    if (Array.isArray(data)) setApiKeys(data);
    setKeysLoading(false);
  };

  const createKey = async () => {
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName || 'My API Key' }),
    });
    const data = await res.json();
    if (data.key) {
      setNewKeyResult(data.key);
      setNewKeyName('');
      loadKeys();
    }
  };

  const deleteKey = async (id: string) => {
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const loadOrgs = async () => {
    setOrgsLoading(true);
    const res = await fetch('/api/orgs');
    const data = await res.json();
    if (Array.isArray(data)) setOrgs(data);
    setOrgsLoading(false);
  };

  const createOrg = async () => {
    if (!newOrgName.trim()) return;
    await fetch('/api/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName }),
    });
    setNewOrgName('');
    loadOrgs();
  };

  const deleteOrg = async (id: string) => {
    await fetch('/api/orgs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setOrgs((prev) => prev.filter((o) => o.id !== id));
  };

  const inviteMember = async () => {
    if (!inviteOrgId || !inviteEmail) return;
    const res = await fetch('/api/orgs/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: inviteOrgId, email: inviteEmail }),
    });
    const data = await res.json();
    setInviteStatus(data.ok ? 'Invited!' : (data.error ?? 'Error'));
    if (data.ok) { setInviteEmail(''); setTimeout(() => setInviteStatus(''), 2000); }
  };

  useEffect(() => {
    if (tab === 'keys') loadKeys();
    if (tab === 'orgs') loadOrgs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    localStorage.setItem('aion_display_name', displayName);
    localStorage.setItem('aion_username', username);
    if (avatar) localStorage.setItem('aion_avatar', avatar);
    else localStorage.removeItem('aion_avatar');
    setProfileSaved(true);
    window.dispatchEvent(new Event('aion:profile'));
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleAccentSelect = (colorOrPreset: string) => {
    setAccentColor(colorOrPreset);
    if (colorOrPreset !== 'rainbow') setCustomColor(colorOrPreset);
    saveAccent(colorOrPreset);
  };

  const handleCustomColor = (color: string) => {
    setCustomColor(color);
    setAccentColor(color);
    saveAccent(color);
  };

  const initials = (displayName || session?.user?.name || '?')[0]?.toUpperCase();

  const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'profile', icon: User,       label: 'Profile' },
    { id: 'general', icon: Settings,   label: 'General' },
    { id: 'keys',    icon: Key,        label: 'API Keys' },
    { id: 'orgs',    icon: Building2,  label: 'Teams' },
    { id: 'help',    icon: HelpCircle, label: 'Help' },
  ];

  return (
    <>
      {/* ── Main modal ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
        <div
          className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--ui-bg-sidebar)',
            boxShadow: '0 32px 96px rgba(0,0,0,0.65)',
            height: 'min(620px, calc(100vh - 2rem))',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b"
            style={{ borderColor: 'var(--ui-border)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--ui-text-1)' }}>Settings</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--ui-text-3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}>
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left nav */}
            <nav className="w-44 shrink-0 border-r py-3 px-2 space-y-0.5"
              style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-rail)' }}>
              {TABS.map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setTab(id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                  style={{
                    background: tab === id ? 'var(--ui-bg-card-hover)' : 'transparent',
                    color: tab === id ? 'var(--ui-text-1)' : 'var(--ui-text-2)',
                    fontWeight: tab === id ? 500 : 400,
                  }}
                  onMouseEnter={(e) => { if (tab !== id) e.currentTarget.style.background = 'var(--ui-bg-card)'; }}
                  onMouseLeave={(e) => { if (tab !== id) e.currentTarget.style.background = 'transparent'; }}>
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </nav>

            {/* Content — fixed height, scrollable */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* ── PROFILE ── */}
              {tab === 'profile' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>Profile</h3>

                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-bold shrink-0"
                        style={{ background: avatar ? undefined : 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}>
                        {avatar
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                          : initials}
                      </div>
                      <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.45)' }}>
                        <Upload size={16} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--ui-input-border)', color: 'var(--ui-text-2)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                        Upload photo
                      </button>
                      {avatar && (
                        <button onClick={() => setAvatar(null)}
                          className="ml-2 text-sm px-3 py-1.5 rounded-lg transition-colors"
                          style={{ color: '#f87171' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ui-bg-card)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          Remove
                        </button>
                      )}
                      <p className="text-xs mt-1.5" style={{ color: 'var(--ui-text-3)' }}>JPG, PNG or GIF · Max 2 MB</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ui-text-2)' }}>Display Name</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your display name" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ui-text-2)' }}>Username</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="username" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }} />
                  </div>

                  <button onClick={handleSaveProfile}
                    className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-opacity"
                    style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                    {profileSaved ? '✓ Saved!' : 'Save changes'}
                  </button>

                  <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ui-border)' }}>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--ui-text-3)' }}>Signed in as</p>
                      <p className="text-sm" style={{ color: 'var(--ui-text-2)' }}>{session?.user?.email}</p>
                    </div>
                    <button onClick={() => signOut({ callbackUrl: '/login' })}
                      className="text-sm px-4 py-2 rounded-xl transition-colors"
                      style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      Sign out
                    </button>
                  </div>
                </div>
              )}

              {/* ── GENERAL ── */}
              {tab === 'general' && (
                <div className="space-y-7">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>General</h3>

                  {/* Theme */}
                  <div>
                    <label className="block text-xs font-medium mb-3" style={{ color: 'var(--ui-text-2)' }}>Theme</label>
                    <div className="flex gap-2">
                      {(['dark', 'light'] as const).map((m) => {
                        const active = (m === 'dark') === isDark;
                        return (
                          <button key={m} onClick={() => { if (!active) toggle(); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-colors"
                            style={{
                              background: active ? 'var(--ui-bg-card-hover)' : 'transparent',
                              borderColor: active ? 'var(--ui-input-border)' : 'var(--ui-border)',
                              color: active ? 'var(--ui-text-1)' : 'var(--ui-text-2)',
                            }}>
                            {m === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                            {m === 'dark' ? 'Dark' : 'Light'}
                            {active && <span className="text-xs opacity-50">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accent color */}
                  <div>
                    <label className="block text-xs font-medium mb-3" style={{ color: 'var(--ui-text-2)' }}>Accent Color</label>
                    <div className="flex flex-wrap gap-2.5 mb-3">
                      {ACCENT_PRESETS.map((preset) => {
                        const isActive = preset.color === 'rainbow' ? accentColor === 'rainbow' : accentColor === preset.color;
                        return (
                          <button key={preset.id} onClick={() => handleAccentSelect(preset.color)} title={preset.label}
                            className="w-8 h-8 rounded-full transition-transform hover:scale-110 relative flex items-center justify-center"
                            style={preset.color === 'rainbow'
                              ? { background: 'conic-gradient(red,orange,yellow,green,cyan,blue,violet,red)', outline: isActive ? '2.5px solid var(--ui-text-1)' : 'none', outlineOffset: 2 }
                              : { background: preset.color, outline: isActive ? '2.5px solid var(--ui-text-1)' : 'none', outlineOffset: 2 }}>
                            {isActive && <span className="text-white text-[10px] font-bold drop-shadow">✓</span>}
                          </button>
                        );
                      })}
                      <label title="Custom color"
                        className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center border-2 border-dashed relative overflow-hidden transition-transform hover:scale-110"
                        style={{ borderColor: 'var(--ui-input-border)' }}>
                        <input type="color" value={customColor} onChange={(e) => handleCustomColor(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <span style={{ color: 'var(--ui-text-2)', fontSize: 18, lineHeight: 1 }}>+</span>
                      </label>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
                      Current:{' '}
                      <span style={{ color: accentColor === 'rainbow' ? undefined : accentColor }}
                        className={accentColor === 'rainbow' ? 'rainbow-text' : ''}>
                        {accentColor === 'rainbow' ? 'Rainbow ✦' : accentColor}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* ── API KEYS ── */}
              {tab === 'keys' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>API Keys</h3>
                  <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
                    Use API keys to access AIon programmatically. Keep them secret — they grant full account access.
                  </p>

                  {/* Create new key */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Key name (optional)"
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }}
                    />
                    <button
                      onClick={createKey}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}
                    >
                      <Plus size={13} /> Generate
                    </button>
                  </div>

                  {/* New key display */}
                  {newKeyResult && (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <p className="text-xs font-medium" style={{ color: '#22C55E' }}>Copy your key now — it won&rsquo;t be shown again!</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs break-all" style={{ color: 'var(--ui-text-1)' }}>{newKeyResult}</code>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(newKeyResult);
                            setKeyCopied(true);
                            setTimeout(() => setKeyCopied(false), 2000);
                          }}
                          className="shrink-0 p-1.5 rounded-lg"
                          style={{ color: keyCopied ? '#22C55E' : 'var(--ui-text-3)' }}
                        >
                          {keyCopied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <button onClick={() => setNewKeyResult(null)} className="text-xs" style={{ color: 'var(--ui-text-3)' }}>Dismiss</button>
                    </div>
                  )}

                  {/* Existing keys */}
                  {keysLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ui-text-3)' }} />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--ui-text-3)' }}>No API keys yet</p>
                  ) : (
                    <div className="space-y-2">
                      {apiKeys.map((k) => (
                        <div key={k.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: 'var(--ui-bg-card)', border: '1px solid var(--ui-border)' }}>
                          <Key size={13} style={{ color: 'var(--ui-text-3)', flexShrink: 0 }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: 'var(--ui-text-1)' }}>{k.name ?? 'Unnamed Key'}</p>
                            <p className="text-xs font-mono" style={{ color: 'var(--ui-text-3)' }}>{k.keyPrefix}…</p>
                          </div>
                          <p className="text-xs shrink-0" style={{ color: 'var(--ui-text-3)' }}>
                            {new Date(k.createdAt).toLocaleDateString()}
                          </p>
                          <button onClick={() => deleteKey(k.id)} className="shrink-0 p-1 rounded-lg transition-colors"
                            style={{ color: 'var(--ui-text-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ui-text-3)')}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ORGANIZATIONS ── */}
              {tab === 'orgs' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>Teams</h3>

                  {/* Create new org */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Team name"
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }}
                      onKeyDown={(e) => e.key === 'Enter' && createOrg()}
                    />
                    <button
                      onClick={createOrg}
                      disabled={!newOrgName.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 shrink-0"
                      style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}
                    >
                      <Plus size={13} /> Create
                    </button>
                  </div>

                  {/* Team list */}
                  {orgsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ui-text-3)' }} />
                    </div>
                  ) : orgs.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--ui-text-3)' }}>No teams yet</p>
                  ) : (
                    <div className="space-y-2">
                      {orgs.map((o) => (
                        <div key={o.id} className="rounded-xl p-3 space-y-2"
                          style={{ background: 'var(--ui-bg-card)', border: '1px solid var(--ui-border)' }}>
                          <div className="flex items-center gap-2">
                            <Building2 size={14} style={{ color: 'var(--ui-text-3)', flexShrink: 0 }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--ui-text-1)' }}>{o.name}</p>
                              <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
                                <Users size={10} className="inline mr-1" />{o.memberCount} member{o.memberCount !== 1 ? 's' : ''} · {o.role}
                              </p>
                            </div>
                            {o.role === 'owner' && (
                              <button onClick={() => deleteOrg(o.id)} className="p-1 rounded-lg"
                                style={{ color: 'var(--ui-text-3)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ui-text-3)')}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          {/* Invite form for owners/admins */}
                          {(o.role === 'owner' || o.role === 'admin') && (
                            <div className="flex gap-2 pt-1 border-t" style={{ borderColor: 'var(--ui-border)' }}>
                              <input
                                type="email"
                                value={inviteOrgId === o.id ? inviteEmail : ''}
                                onChange={(e) => { setInviteOrgId(o.id); setInviteEmail(e.target.value); }}
                                placeholder="Invite by email…"
                                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                                style={{ background: 'var(--ui-input-bg)', border: '1px solid var(--ui-input-border)', color: 'var(--ui-text-1)' }}
                              />
                              <button
                                onClick={inviteMember}
                                disabled={!inviteEmail.trim() || inviteOrgId !== o.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                                style={{ background: '#8B5CF6' }}
                              >
                                {inviteStatus && inviteOrgId === o.id ? inviteStatus : 'Invite'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── HELP ── */}
              {tab === 'help' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ui-text-1)' }}>Help &amp; Support</h3>
                  {[
                    { icon: Headphones, label: 'Help Center',      desc: 'Ask us anything',          action: () => setDialog('help-center') },
                    { icon: FileText,   label: 'Terms of Service',  desc: 'Read our terms',            action: () => setDialog('tos') },
                    { icon: Shield,     label: 'Privacy Policy',    desc: 'How we handle your data',   action: () => setDialog('privacy') },
                    { icon: Bug,        label: 'Report a Bug',      desc: 'Tell us what went wrong',   action: () => setDialog('report-bug') },
                  ].map(({ icon: Icon, label, desc, action }) => (
                    <button key={label} onClick={action}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors text-left"
                      style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-text-2)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-card)'; e.currentTarget.style.color = 'var(--ui-text-1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-2)'; }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'var(--ui-bg-card)' }}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--ui-text-1)' }}>{label}</p>
                        <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-dialogs ── */}
      {dialog === 'help-center' && (
        <ContactDialog
          title="Help Center"
          placeholder="Describe what you need help with…"
          type="help"
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'report-bug' && (
        <ContactDialog
          title="Report a Bug"
          placeholder="Describe the bug — what happened, steps to reproduce, what you expected…"
          type="bug"
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'privacy' && (
        <TextDialog title="Privacy Policy" onClose={() => setDialog(null)}>
          {PRIVACY_CONTENT}
        </TextDialog>
      )}
      {dialog === 'tos' && (
        <TextDialog title="Terms of Service" onClose={() => setDialog(null)}>
          {TOS_CONTENT}
        </TextDialog>
      )}
    </>
  );
}
