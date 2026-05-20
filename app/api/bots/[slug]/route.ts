import { NextResponse } from 'next/server';
import { db, ensureSchema } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await ensureSchema();
    const { slug } = await params;

    const { rows } = await db.query<{
      id: string; slug: string; name: string; description: string | null;
      avatar_url: string | null; category: string | null;
      is_system_bot: boolean; usage_count: string; like_count: string;
      tags: string[] | null;
    }>(
      `SELECT id, slug, name, description, avatar_url, category,
              is_system_bot, usage_count, like_count, tags
       FROM bots
       WHERE slug = $1 AND is_public = TRUE AND is_active = TRUE`,
      [slug],
    );

    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const b = rows[0];
    return NextResponse.json({
      id: String(b.id),
      slug: b.slug,
      name: b.name,
      description: b.description,
      avatarUrl: b.avatar_url,
      category: b.category,
      isSystemBot: b.is_system_bot,
      usageCount: Number(b.usage_count),
      likeCount: Number(b.like_count),
      tags: b.tags ?? [],
    });
  } catch (err) {
    console.error('[/api/bots/[slug] GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
