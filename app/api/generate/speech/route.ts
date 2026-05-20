import { NextResponse } from 'next/server';

// Google Translate TTS — free, no API key required, returns MP3
// Long texts are split into ≤200-char chunks and concatenated.
function splitText(text: string, maxLen = 195): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

async function fetchChunk(text: string, lang: string): Promise<ArrayBuffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Google TTS error ${res.status}`);
  return res.arrayBuffer();
}

export async function POST(req: Request) {
  try {
    const { text, voice = 'en' } = await req.json() as { text?: string; voice?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const lang = voice ?? 'en';
    const chunks = splitText(text.trim());
    const buffers = await Promise.all(chunks.map(c => fetchChunk(c, lang)));

    // Concatenate all MP3 chunks
    const total = buffers.reduce((n, b) => n + b.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) {
      merged.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }

    const base64 = Buffer.from(merged).toString('base64');
    return NextResponse.json({ url: `data:audio/mp3;base64,${base64}` });
  } catch (err) {
    console.error('[/api/generate/speech]', err);
    return NextResponse.json({ error: 'Speech generation failed' }, { status: 500 });
  }
}
