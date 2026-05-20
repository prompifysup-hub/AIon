import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureUserInDb } from '@/lib/ensure-user';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ balance: 0, loggedIn: false });
    }

    const dbUserId = await ensureUserInDb(session);

    const { rows } = await db.query<{
      balance: string; lifetime_earned: string; lifetime_spent: string;
    }>(
      `SELECT balance, lifetime_earned, lifetime_spent FROM user_credits WHERE user_id = $1`,
      [dbUserId],
    );

    if (!rows[0]) {
      await db.query(
        `INSERT INTO user_credits (user_id, balance, lifetime_earned)
         VALUES ($1, 1000, 1000)
         ON CONFLICT (user_id) DO NOTHING`,
        [dbUserId],
      );
      return NextResponse.json({ balance: 1000, lifetime_earned: 1000, lifetime_spent: 0, loggedIn: true });
    }

    return NextResponse.json({
      balance: Number(rows[0].balance),
      lifetime_earned: Number(rows[0].lifetime_earned),
      lifetime_spent: Number(rows[0].lifetime_spent),
      loggedIn: true,
    });
  } catch (err) {
    console.error('[/api/credits GET]', err);
    return NextResponse.json({ balance: 0, loggedIn: false });
  }
}
