import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 4 cinematic shots that together form a visual narrative
const SHOTS = [
  'wide establishing shot, cinematic 4K, dramatic sky, golden hour lighting, film grain',
  'close-up detail, vivid colors, shallow depth of field, bokeh, sharp focus',
  'medium shot, atmospheric haze, moody blue-hour lighting, cinematic',
  'dynamic low-angle, epic scale, lens flare, motion implied, cinematic composition',
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
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced)}?width=1280&height=720&nologo=true&seed=${seed}&model=flux-schnell`;
  });

  return NextResponse.json({ frames, prompt: prompt.trim() });
}
