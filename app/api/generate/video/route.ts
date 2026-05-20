import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const MODEL_MAP: Record<string, string> = {
  'video-turbo':     'turbo',
  'video-cinematic': 'cinematic',
  'video-animation': 'animation',
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt, model: modelParam } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

  const pollinationsModel = MODEL_MAP[modelParam] ?? 'turbo';
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?model=${pollinationsModel}&seed=${seed}&nologo=true`;

  return NextResponse.json({ url });
}
