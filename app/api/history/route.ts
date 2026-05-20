import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/db';
import type { Conversation } from '@/lib/history';

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? 'local';
}

export async function GET() {
  try {
    const userId = await getUserId();
    await ensureSchema();

    const { rows } = await db.query<{
      id: string; title: string; model_id: string; provider: string;
      messages: Conversation['messages']; starred: boolean;
      created_at: string; updated_at: string;
    }>(
      `SELECT id, title, model_id, provider, messages, starred, created_at, updated_at
       FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`,
      [userId],
    );

    return NextResponse.json(rows.map((r) => ({
      id: r.id,
      title: r.title,
      modelId: r.model_id,
      provider: r.provider,
      messages: r.messages,
      starred: r.starred,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    console.error('[/api/history GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    await ensureSchema();

    const conv: Conversation = await req.json();

    await db.query(
      `INSERT INTO conversations
         (id, user_id, title, model_id, provider, messages, starred, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         title      = EXCLUDED.title,
         model_id   = EXCLUDED.model_id,
         provider   = EXCLUDED.provider,
         messages   = EXCLUDED.messages,
         starred    = EXCLUDED.starred,
         updated_at = EXCLUDED.updated_at`,
      [
        conv.id, userId, conv.title, conv.modelId, conv.provider,
        JSON.stringify(conv.messages), conv.starred ?? false,
        conv.createdAt, conv.updatedAt,
      ],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/history POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const { id } = await req.json();

    await db.query(
      `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/history DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getUserId();
    await ensureSchema();

    const { id } = await req.json();

    await db.query(
      `UPDATE conversations SET starred = NOT starred WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/history PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
