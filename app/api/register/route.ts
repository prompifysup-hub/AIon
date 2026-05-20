import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, createUser } from '@/lib/users';
import { db, ensureSchema } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (await getUserByEmail(email)) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    await ensureSchema();
    const passwordHash = await bcrypt.hash(password, 10);
    const { id: userId } = await createUser({ email, name, passwordHash, createdAt: new Date().toISOString() });

    const WELCOME_CREDITS = 1000;

    await db.query(
      `INSERT INTO user_credits (user_id, balance, lifetime_earned)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, WELCOME_CREDITS],
    );
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, balance_after, type, description)
       VALUES ($1, $2, $2, 'grant', 'Welcome bonus credits')`,
      [userId, WELCOME_CREDITS],
    );
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES ($1, 'welcome', 'Welcome to AIon! 🎉', $2)`,
      [userId, `You've received ${WELCOME_CREDITS} free credits. Each AI message costs 1 credit. Enjoy!`],
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[register]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
