import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/db';
import { ensureUserInDb } from '@/lib/ensure-user';

export async function GET() {
  try {
    await ensureSchema();
    const session = await getServerSession(authOptions);

    const { rows: bots } = await db.query<{
      id: string; slug: string; name: string; description: string | null;
      avatar_url: string | null; category: string | null; is_system_bot: boolean;
      usage_count: string; like_count: string; tags: string[] | null;
      creator_name: string | null;
    }>(
      `SELECT id, slug, name, description, avatar_url, category, is_system_bot,
              usage_count, like_count, tags, creator_name
       FROM bots
       WHERE is_public = TRUE AND is_active = TRUE
       ORDER BY is_system_bot DESC, usage_count DESC`,
    );

    let favoriteIds = new Set<string>();
    if (session?.user?.id) {
      try {
        const dbUserId = await ensureUserInDb(session);
        const { rows: favRows } = await db.query<{ bot_id: string }>(
          `SELECT bot_id FROM user_bot_favorites WHERE user_id = $1`,
          [dbUserId],
        );
        favoriteIds = new Set(favRows.map((r) => String(r.bot_id)));
      } catch { /* not critical */ }
    }

    return NextResponse.json(
      bots.map((b) => ({
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
        isFavorite: favoriteIds.has(String(b.id)),
        creatorName: b.creator_name ?? 'Community',
      })),
    );
  } catch (err) {
    console.error('[/api/bots GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: toggle favorite
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { botId, action } = await req.json();
    if (!botId) return NextResponse.json({ error: 'botId required' }, { status: 400 });

    const dbUserId = await ensureUserInDb(session);

    if (action === 'unfavorite') {
      await db.query(
        `DELETE FROM user_bot_favorites WHERE user_id = $1 AND bot_id = $2`,
        [dbUserId, botId],
      );
    } else {
      await db.query(
        `INSERT INTO user_bot_favorites (user_id, bot_id) VALUES ($1, $2)
         ON CONFLICT (user_id, bot_id) DO NOTHING`,
        [dbUserId, botId],
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/bots POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
