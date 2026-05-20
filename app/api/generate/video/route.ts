import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 2 cinematic shots — enough for a storyboard, loads fast
const SHOTS = [
  'wide establishing shot, cinematic, dramatic sky, golden hour lighting',
  'close-up detail shot, vivid colors, bokeh, sharp focus, cinematic',
];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

  const baseSeed = Math.floor(Math.random() * 1_000_000);

  const frames = SHOTS.map((shot, i) => {
    const seed = baseSeed + i * 1337;
    const enhanced = `${prompt.trim()}, ${shot}`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced)}?width=768&height=432&nologo=true&seed=${seed}&model=flux-schnell`;
  });

  return NextResponse.json({ frames, prompt: prompt.trim() });
}
