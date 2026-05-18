import { NextResponse } from 'next/server';

export const maxDuration = 25;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topic = (searchParams.get('topic') ?? '').trim();
  if (!topic) return NextResponse.json({ error: 'Missing topic' }, { status: 400 });

  const toB64 = async (res: Response) => {
    const mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mime };
  };

  // ── 1. Wikipedia editorial photo ─────────────────────────────────
  try {
    const term = encodeURIComponent(topic.split(/\s+/).slice(0, 4).join('_'));
    const wiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${term}`, {
      headers: { 'User-Agent': 'PolyChat/1.0 (https://github.com/Patcharada37778/PolyChat)' },
      signal: AbortSignal.timeout(8000),
    });
    if (wiki.ok) {
      const json = await wiki.json();
      const imgUrl: string | undefined = json.originalimage?.source ?? json.thumbnail?.source;
      if (imgUrl) {
        const img = await fetch(imgUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://en.wikipedia.org/' },
          signal: AbortSignal.timeout(10000),
        });
        if (img.ok) return NextResponse.json(await toB64(img));
      }
    }
  } catch { /* fall through */ }

  // ── 2. Unsplash Source fallback (follows redirect to CDN image) ───
  try {
    const kw = encodeURIComponent(topic.split(/\s+/).slice(0, 3).join(','));
    const unsplash = await fetch(`https://source.unsplash.com/1280x720/?${kw}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (unsplash.ok && unsplash.headers.get('content-type')?.startsWith('image/')) {
      return NextResponse.json(await toB64(unsplash));
    }
  } catch { /* fall through */ }

  return NextResponse.json({ error: 'No image found' }, { status: 404 });
}
