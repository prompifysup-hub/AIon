import { db } from './db';
import type { Session } from 'next-auth';

/**
 * Returns the real PG BIGINT user ID for the current session.
 * If the user row doesn't exist yet (stale JWT / pre-migration session),
 * it is created on the fly using session email so FK inserts succeed.
 */
export async function ensureUserInDb(session: Session): Promise<string> {
  const email = session.user?.email;
  if (!email) throw new Error('No email in session');

  // 1. If session.user.id looks like a PG integer, check that row first
  const maybeId = parseInt(session.user?.id ?? '', 10);
  if (!isNaN(maybeId)) {
    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [maybeId],
    );
    if (rows[0]) return String(rows[0].id);
  }

  // 2. Find by email (user registered but session token has wrong/stale ID)
  const { rows: byEmail } = await db.query<{ id: string }>(
    'SELECT id FROM users WHERE email ILIKE $1',
    [email],
  );
  if (byEmail[0]) return String(byEmail[0].id);

  // 3. Create the user row so FK operations can proceed
  const base = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 25) || 'user';
  const username = `${base}_${Math.random().toString(36).slice(2, 7)}`;
  const { rows: created } = await db.query<{ id: string }>(
    `INSERT INTO users (email, username, display_name, auth_provider, email_verified, is_active)
     VALUES ($1, $2, $3, 'email', TRUE, TRUE)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [email, username, session.user?.name || base],
  );
  return String(created[0].id);
}
