import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topic = (searchParams.get('topic') ?? '').trim();
  if (!topic) return NextResponse.json({ error: 'Missing topic' }, { status: 400 });

  const toB64 = async (res: Response) => {
    const mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mime };
  };

  const fetchImage = async (url: string, headers: Record<string, string> = {}) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', ...headers },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        return await toB64(res);
      }
    } catch { /* fall through */ }
    return null;
  };

  // ── 1. Wikipedia MediaWiki search API (finds images even for non-exact titles)
  try {
    const mwUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(topic)}&prop=pageimages&pithumbsize=1200&format=json&gsrlimit=1`;
    const mwRes = await fetch(mwUrl, {
      headers: { 'User-Agent': 'PolyChat/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (mwRes.ok) {
      const mwJson = await mwRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pages = Object.values((mwJson.query?.pages ?? {}) as Record<string, any>);
      const imgUrl: string | undefined = pages[0]?.thumbnail?.source;
      if (imgUrl) {
        const result = await fetchImage(imgUrl, { Referer: 'https://en.wikipedia.org/' });
        if (result) return NextResponse.json(result);
      }
    }
  } catch { /* fall through */ }

  // ── 2. Unsplash Source (follows redirect to CDN image)
  try {
    const kw = topic.split(/\s+/).slice(0, 3).join(',');
    const result = await fetchImage(`https://source.unsplash.com/1280x720/?${encodeURIComponent(kw)}`);
    if (result) return NextResponse.json(result);
  } catch { /* fall through */ }

  // ── 3. Picsum with topic-seeded number (always works, guaranteed image)
  const seed = Math.abs(topic.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0));
  const result = await fetchImage(`https://picsum.photos/seed/${seed}/1280/720`);
  if (result) return NextResponse.json(result);

  return NextResponse.json({ error: 'No image found' }, { status: 404 });
}
