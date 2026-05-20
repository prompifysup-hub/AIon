import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureUserInDb } from '@/lib/ensure-user';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportedType, reportedId, reason, description } = await req.json();
    if (!reportedType || !reportedId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dbUserId = await ensureUserInDb(session);
    await db.query(
      `INSERT INTO reports (reporter_id, reported_type, reported_id, reason, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [dbUserId, reportedType, reportedId, reason, description ?? null],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/reports POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
