import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
    return NextResponse.json({ data: b64, mime });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
