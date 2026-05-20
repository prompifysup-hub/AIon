import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, messageUuid, rating, feedbackText } = await req.json();
    if (!conversationId || !messageUuid || typeof rating !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await ensureSchema();
    const userId = session.user.email;

    await db.query(
      `INSERT INTO aion_message_feedback
         (user_id, conversation_id, message_uuid, rating, feedback_text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, message_uuid)
       DO UPDATE SET rating = EXCLUDED.rating, feedback_text = EXCLUDED.feedback_text`,
      [userId, conversationId, messageUuid, rating, feedbackText ?? null],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/feedback POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({});
    }

    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    if (!conversationId) return NextResponse.json({});

    const { rows } = await db.query<{ message_uuid: string; rating: number }>(
      `SELECT message_uuid, rating FROM aion_message_feedback
       WHERE user_id = $1 AND conversation_id = $2`,
      [session.user.email, conversationId],
    );

    const map: Record<string, number> = {};
    for (const r of rows) map[r.message_uuid] = r.rating;
    return NextResponse.json(map);
  } catch (err) {
    console.error('[/api/feedback GET]', err);
    return NextResponse.json({});
  }
}
