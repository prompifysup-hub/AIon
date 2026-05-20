import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json([]);

    const { rows } = await db.query<{
      id: string; type: string; title: string; body: string | null;
      is_read: boolean; created_at: string;
    }>(
      `SELECT id, type, title, body, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [session.user.id],
    );

    return NextResponse.json(rows.map((r) => ({
      id: String(r.id),
      type: r.type,
      title: r.title,
      body: r.body,
      isRead: r.is_read,
      createdAt: r.created_at,
    })));
  } catch (err) {
    console.error('[/api/notifications GET]', err);
    return NextResponse.json([]);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id: string | null = body.id ?? null;

    if (id) {
      await db.query(
        `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
        [id, session.user.id],
      );
    } else {
      await db.query(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
        [session.user.id],
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/notifications PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
