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
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Music generation needs a free HuggingFace API key. Get one at huggingface.co/join, then add HUGGINGFACE_API_KEY=hf_xxx to .env.local and restart the server.' },
        { status: 503 },
      );
    }

    const { prompt, model = 'musicgen-small' } = await req.json() as { prompt?: string; model?: string };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const hfModel = HF_MODEL[model] ?? 'facebook/musicgen-small';

    const res = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (res.status === 503) {
      const data = await res.json().catch(() => ({})) as { estimated_time?: number };
      const wait = data.estimated_time ? ` Model loading, try again in ~${Math.ceil(data.estimated_time)}s.` : ' Model is loading, try again in 20–30 seconds.';
      return NextResponse.json({ error: `Model is warming up.${wait}` }, { status: 503 });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: `Generation failed (${res.status}): ${text}` }, { status: res.status });
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
