'use client';

import { Message } from '@/types';

export interface Conversation {
  id: string;
  title: string;
  modelId: string;   // OpenRouter model ID or legacy tier ('fast'|'balanced'|'pro')
  provider: string;  // category (e.g. 'text') or legacy provider ('gemini'|'deepseek'|'qwen')
  messages: Message[];
  starred?: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getHistory(): Promise<Conversation[]> {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(conv),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch('/api/history', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

export async function toggleStarConversation(id: string): Promise<void> {
  await fetch('/api/history', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
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
