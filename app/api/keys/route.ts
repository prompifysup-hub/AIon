import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureUserInDb } from '@/lib/ensure-user';
import { createHash, randomBytes } from 'crypto';

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await ensureUserInDb(session);

    const { rows } = await db.query<{
      id: string; name: string | null; key_prefix: string; permissions: object;
      rate_limit_per_minute: number; last_used_at: string | null;
      expires_at: string | null; is_active: boolean; created_at: string;
    }>(
      `SELECT id, name, key_prefix, permissions, rate_limit_per_minute,
              last_used_at, expires_at, is_active, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return NextResponse.json(
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        keyPrefix: r.key_prefix,
        permissions: r.permissions,
        rateLimitPerMinute: r.rate_limit_per_minute,
        lastUsedAt: r.last_used_at,
        expiresAt: r.expires_at,
        isActive: r.is_active,
        createdAt: r.created_at,
      })),
    );
  } catch (err) {
    console.error('[/api/keys GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await req.json();
    const userId = await ensureUserInDb(session);

    const rawKey = `aion_${randomBytes(32).toString('hex')}`;
    const prefix = rawKey.slice(0, 12);
    const keyHash = hashKey(rawKey);

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, name ?? 'My API Key', keyHash, prefix],
    );

    return NextResponse.json({ id: String(rows[0].id), key: rawKey, prefix });
  } catch (err) {
    console.error('[/api/keys POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await ensureUserInDb(session);
    const { id } = await req.json();
    await db.query(
      `DELETE FROM api_keys WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/keys DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
