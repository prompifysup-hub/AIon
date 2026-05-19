'use client';

import { Message } from '@/types';

export interface Conversation {
  id: string;
  title: string;
  modelId: string;   // OR model ID (e.g. 'google/gemini-2.0-flash-001') or legacy tier ('fast'|'balanced'|'pro')
  provider: string;  // category (e.g. 'text') or legacy provider ('gemini'|'deepseek'|'qwen')
  messages: Message[];
  starred?: boolean;
  createdAt: string;
  updatedAt: string;
}

function key(userId: string) {
  return `aion_history_${userId}`;
}

export function getHistory(userId: string): Conversation[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? '[]');
  } catch {
    return [];
  }
}

export function saveConversation(conv: Conversation, userId: string) {
  if (!userId) return;
  const all = getHistory(userId);
  const idx = all.findIndex((c) => c.id === conv.id);
  if (idx >= 0) all[idx] = conv;
  else all.unshift(conv);
  localStorage.setItem(key(userId), JSON.stringify(all.slice(0, 100)));
}

export function deleteConversation(id: string, userId: string) {
  if (!userId) return;
  const all = getHistory(userId).filter((c) => c.id !== id);
  localStorage.setItem(key(userId), JSON.stringify(all));
}

export function toggleStarConversation(id: string, userId: string) {
  if (!userId) return;
  const all = getHistory(userId).map((c) =>
    c.id === id ? { ...c, starred: !c.starred } : c
  );
  localStorage.setItem(key(userId), JSON.stringify(all));
}

export function groupByDate(convs: Conversation[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 7);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const c of convs) {
    const d = new Date(c.updatedAt);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= week) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}
