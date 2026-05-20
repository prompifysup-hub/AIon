import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, voice = 'alloy' } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1-hd', input: text, voice, response_format: 'mp3' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: err.error?.message || `TTS error ${res.status}` },
        { status: res.status },
      );
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return NextResponse.json({ url: `data:audio/mp3;base64,${base64}` });
  } catch (err) {
    console.error('[/api/generate/speech]', err);
    return NextResponse.json({ error: 'Speech generation failed' }, { status: 500 });
  }
}
