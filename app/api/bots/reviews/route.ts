import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const botId = searchParams.get('botId');
    if (!botId) return NextResponse.json([]);

    const { rows } = await db.query<{
      id: string; rating: number; review_text: string | null; created_at: string;
      user_email: string | null; user_name: string | null;
    }>(
      `SELECT br.id, br.rating, br.review_text, br.created_at,
              u.email AS user_email, u.display_name AS user_name
       FROM bot_reviews br
       LEFT JOIN users u ON u.id = br.user_id
       WHERE br.bot_id = $1
       ORDER BY br.created_at DESC
       LIMIT 50`,
      [botId],
    );

    return NextResponse.json(
      rows.map((r) => ({
        id: String(r.id),
        rating: r.rating,
        reviewText: r.review_text,
        createdAt: r.created_at,
        userName: r.user_name ?? r.user_email?.split('@')[0] ?? 'Anonymous',
      })),
    );
  } catch (err) {
    console.error('[/api/bots/reviews GET]', err);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { botId, rating, reviewText } = await req.json();
    if (!botId || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    await db.query(
      `INSERT INTO bot_reviews (bot_id, user_id, rating, review_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bot_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text, updated_at = NOW()`,
      [botId, session.user.id, rating, reviewText ?? null],
    );
    await db.query(
      `UPDATE bots SET like_count = (
         SELECT COUNT(*) FROM bot_reviews WHERE bot_id = $1 AND rating >= 4
       ) WHERE id = $1`,
      [botId],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/bots/reviews POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
