import { NextResponse } from 'next/server';

const HF_MODEL: Record<string, string> = {
  'musicgen-small':        'facebook/musicgen-small',
  'musicgen-medium':       'facebook/musicgen-medium',
  'musicgen-large':        'facebook/musicgen-large',
  'musicgen-stereo-small': 'facebook/musicgen-stereo-small',
  'musicgen-stereo-large': 'facebook/musicgen-stereo-large',
};

export async function POST(req: Request) {
  try {
    const { prompt, model = 'musicgen-small' } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const hfModel = HF_MODEL[model] ?? 'facebook/musicgen-small';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.HUGGINGFACE_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
    }

    const res = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Music generation failed (${res.status}): ${text}` },
        { status: res.status },
      );
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'audio/flac';
    return NextResponse.json({ url: `data:${contentType};base64,${base64}` });
  } catch (err) {
    console.error('[/api/generate/audio]', err);
    return NextResponse.json({ error: 'Audio generation failed' }, { status: 500 });
  }
}
