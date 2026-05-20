import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET — return org info for this invite token (no auth required)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const { rows } = await db.query<{
      org_id: string; org_name: string; member_count: string;
    }>(
      `SELECT oi.org_id, o.name AS org_name,
              (SELECT COUNT(*) FROM organization_members WHERE organization_id = oi.org_id)::text AS member_count
       FROM organization_invites oi
       JOIN organizations o ON o.id = oi.org_id
       WHERE oi.token = $1`,
      [token],
    );

    if (!rows[0]) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
    }

    return NextResponse.json({
      orgId: String(rows[0].org_id),
      orgName: rows[0].org_name,
      memberCount: Number(rows[0].member_count),
    });
  } catch (err) {
    console.error('[/api/invite GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — join the org using this invite token (requires auth)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await params;

    const { rows } = await db.query<{ org_id: string }>(
      `SELECT org_id FROM organization_invites WHERE token = $1`,
      [token],
    );

    if (!rows[0]) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    const orgId = rows[0].org_id;

    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [orgId, session.user.id],
    );

    return NextResponse.json({ ok: true, orgId: String(orgId) });
  } catch (err) {
    console.error('[/api/invite POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
