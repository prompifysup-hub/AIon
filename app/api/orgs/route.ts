import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows } = await db.query<{
      id: string; name: string; slug: string; logo_url: string | null;
      max_members: number; member_count: string; role: string; created_at: string;
    }>(
      `SELECT o.id, o.name, o.slug, o.logo_url, o.max_members,
              COUNT(om2.id) AS member_count,
              om.role, o.created_at
       FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $1
       LEFT JOIN organization_members om2 ON om2.organization_id = o.id
       GROUP BY o.id, om.role
       ORDER BY o.created_at DESC`,
      [session.user.id],
    );

    return NextResponse.json(
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        slug: r.slug,
        logoUrl: r.logo_url,
        maxMembers: r.max_members,
        memberCount: Number(r.member_count),
        role: r.role,
        createdAt: r.created_at,
      })),
    );
  } catch (err) {
    console.error('[/api/orgs GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
      + '-' + Math.random().toString(36).slice(2, 6);

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, owner_id) VALUES ($1, $2, $3) RETURNING id`,
      [name.trim(), slug, session.user.id],
    );
    const orgId = rows[0].id;

    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [orgId, session.user.id],
    );

    return NextResponse.json({ id: String(orgId), slug });
  } catch (err) {
    console.error('[/api/orgs POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    await db.query(
      `DELETE FROM organizations WHERE id = $1 AND owner_id = $2`,
      [id, session.user.id],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/orgs DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
