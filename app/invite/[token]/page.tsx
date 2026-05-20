'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Users, Building2, CheckCircle, ArrowRight } from 'lucide-react';

interface OrgInfo {
  orgId: string;
  orgName: string;
  memberCount: number;
}

export default function InvitePage() {
  const { token } = useParams() as { token: string };
  const { data: session, status } = useSession();
  const router = useRouter();

  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setOrgInfo(data);
      })
      .catch(() => setLoadError('Failed to load invite. Please try again.'));
  }, [token]);

  const handleJoin = async () => {
    if (status !== 'authenticated') {
      // Save intended destination and redirect to login
      sessionStorage.setItem('aion_post_login', `/invite/${token}`);
      signIn();
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch(`/api/invite/${token}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setJoined(true);
        setTimeout(() => router.push('/chat'), 2000);
      } else {
        setJoinError(data.error ?? 'Failed to join. Please try again.');
      }
    } catch {
      setJoinError('Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const isLoading = status === 'loading' || (!orgInfo && !loadError);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--ui-bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--ui-bg-sidebar)', border: '1px solid var(--ui-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
      >
        {/* Header gradient bar */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#8B5CF6,#3B82F6,#06B6D4)' }} />

        <div className="p-8 flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-xl font-bold">A</span>
          </div>

          {isLoading ? (
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ui-text-3)' }} />
          ) : loadError ? (
            <div className="text-center space-y-2">
              <p className="text-2xl">😕</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ui-text-1)' }}>
                Invalid Invite Link
              </p>
              <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
                {loadError}
              </p>
              <button
                onClick={() => router.push('/chat')}
                className="mt-4 text-sm px-4 py-2 rounded-xl"
                style={{ background: 'var(--ui-bg-card)', color: 'var(--ui-text-2)', border: '1px solid var(--ui-border)' }}
              >
                Go to AIon
              </button>
            </div>
          ) : joined ? (
            <div className="text-center space-y-3">
              <CheckCircle size={40} style={{ color: '#22C55E', margin: '0 auto' }} />
              <p className="text-base font-semibold" style={{ color: 'var(--ui-text-1)' }}>
                You joined <span style={{ color: '#8B5CF6' }}>{orgInfo!.orgName}</span>!
              </p>
              <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>Redirecting to AIon…</p>
              <Loader2 size={14} className="animate-spin mx-auto" style={{ color: 'var(--ui-text-3)' }} />
            </div>
          ) : (
            <div className="w-full text-center space-y-5">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--ui-text-3)' }}>
                  You&apos;ve been invited to join
                </p>
                <div
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl"
                  style={{ background: 'var(--ui-bg-card)', border: '1px solid var(--ui-border)' }}
                >
                  <Building2 size={18} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                  <p className="text-lg font-bold" style={{ color: 'var(--ui-text-1)' }}>
                    {orgInfo!.orgName}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2" style={{ color: 'var(--ui-text-3)' }}>
                  <Users size={12} />
                  <span className="text-xs">
                    {orgInfo!.memberCount} member{orgInfo!.memberCount !== 1 ? 's' : ''} already
                  </span>
                </div>
              </div>

              {joinError && (
                <p className="text-xs text-red-400">{joinError}</p>
              )}

              {status === 'unauthenticated' && (
                <p className="text-xs" style={{ color: 'var(--ui-text-3)' }}>
                  You need to sign in before joining.
                </p>
              )}

              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {joining ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : status === 'unauthenticated' ? (
                  <>Sign in to join <ArrowRight size={15} /></>
                ) : (
                  <>Join {orgInfo!.orgName} <ArrowRight size={15} /></>
                )}
              </button>

              <button
                onClick={() => router.push('/chat')}
                className="text-xs"
                style={{ color: 'var(--ui-text-3)' }}
              >
                Maybe later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
