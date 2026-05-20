import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) return NextResponse.json([]);

    const { rows } = await db.query<{
      user_id: string; role: string; joined_at: string;
      email: string | null; display_name: string | null;
    }>(
      `SELECT om.user_id, om.role, om.joined_at, u.email, u.display_name
       FROM organization_members om
       LEFT JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1`,
      [orgId],
    );

    return NextResponse.json(
      rows.map((r) => ({
        userId: String(r.user_id),
        role: r.role,
        joinedAt: r.joined_at,
        email: r.email,
        displayName: r.display_name,
      })),
    );
  } catch (err) {
    console.error('[/api/orgs/members GET]', err);
    return NextResponse.json([]);
  }
}

// Invite member by email
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, email, role = 'member' } = await req.json();
    if (!orgId || !email) return NextResponse.json({ error: 'orgId and email required' }, { status: 400 });

    // Verify requester is owner/admin
    const { rows: authRows } = await db.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, session.user.id],
    );
    if (!authRows[0] || !['owner', 'admin'].includes(authRows[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find user by email
    const { rows: userRows } = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE email ILIKE $1`,
      [email],
    );
    if (!userRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const targetUserId = userRows[0].id;
    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [orgId, targetUserId, role],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/orgs/members POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, userId } = await req.json();

    // Can remove self, or owner can remove others
    if (userId !== session.user.id) {
      const { rows } = await db.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [orgId, session.user.id],
      );
      if (!rows[0] || rows[0].role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await db.query(
      `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/orgs/members DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
