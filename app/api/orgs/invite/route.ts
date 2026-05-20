import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/db';
import { ensureUserInDb } from '@/lib/ensure-user';
import { randomUUID } from 'crypto';

async function assertOrgRole(orgId: string, userId: string) {
  const { rows } = await db.query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId],
  );
  if (!rows[0] || !['owner', 'admin'].includes(rows[0].role)) return null;
  return rows[0].role as string;
}

// GET ?orgId=xxx — return existing token (or create one)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

    const userId = await ensureUserInDb(session);
    if (!await assertOrgRole(orgId, userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureSchema();

    const { rows } = await db.query<{ token: string }>(
      `SELECT token FROM organization_invites WHERE org_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orgId],
    );

    if (rows[0]) return NextResponse.json({ token: rows[0].token });

    const token = randomUUID();
    await db.query(
      `INSERT INTO organization_invites (org_id, token, created_by) VALUES ($1, $2, $3)`,
      [orgId, token, userId],
    );
    return NextResponse.json({ token });
  } catch (err) {
    console.error('[/api/orgs/invite GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST {orgId} — regenerate invite link
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId } = await req.json();
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

    const userId = await ensureUserInDb(session);
    if (!await assertOrgRole(orgId, userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureSchema();

    const token = randomUUID();
    await db.query(`DELETE FROM organization_invites WHERE org_id = $1`, [orgId]);
    await db.query(
      `INSERT INTO organization_invites (org_id, token, created_by) VALUES ($1, $2, $3)`,
      [orgId, token, userId],
    );

    return NextResponse.json({ token });
  } catch (err) {
    console.error('[/api/orgs/invite POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
