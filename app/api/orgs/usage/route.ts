import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureUserInDb } from '@/lib/ensure-user';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

    const dbUserId = await ensureUserInDb(session);

    // Must be a member to view
    const { rows: check } = await db.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, dbUserId],
    );
    if (!check[0]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { rows } = await db.query<{
      user_id: string;
      display_name: string | null;
      email: string;
      role: string;
      joined_at: string;
      messages_30d: string;
      credits_30d: string;
      total_credits_spent: string;
    }>(
      `SELECT
         om.user_id,
         u.display_name,
         u.email,
         om.role,
         om.joined_at,
         COALESCE(SUM(dus.messages_sent) FILTER (WHERE dus.date >= CURRENT_DATE - 30), 0)::text AS messages_30d,
         COALESCE(SUM(dus.credits_used)  FILTER (WHERE dus.date >= CURRENT_DATE - 30), 0)::text AS credits_30d,
         COALESCE(uc.lifetime_spent, 0)::text AS total_credits_spent
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
       LEFT JOIN daily_usage_stats dus ON dus.user_id = om.user_id
       LEFT JOIN user_credits uc ON uc.user_id = om.user_id
       WHERE om.organization_id = $1
       GROUP BY om.user_id, u.display_name, u.email, om.role, om.joined_at, uc.lifetime_spent
       ORDER BY om.role DESC, om.joined_at ASC`,
      [orgId],
    );

    return NextResponse.json(
      rows.map((r) => ({
        userId: String(r.user_id),
        displayName: r.display_name ?? r.email.split('@')[0],
        email: r.email,
        role: r.role,
        joinedAt: r.joined_at,
        messages30d: Number(r.messages_30d),
        credits30d: Number(r.credits_30d),
        totalCreditsSpent: Number(r.total_credits_spent),
      })),
    );
  } catch (err) {
    console.error('[/api/orgs/usage GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
