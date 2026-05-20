import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  const dbTest = await db.query('SELECT COUNT(*) as cnt FROM conversations').then(r => r.rows[0]).catch(e => ({ error: e.message }));
  return NextResponse.json({ session, db: dbTest });
}
