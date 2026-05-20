import { db } from './db';
import { User } from '@/types';

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { rows } = await db.query<{
    id: string; email: string; display_name: string | null;
    username: string; password_hash: string | null; created_at: string;
  }>(
    `SELECT id, email, display_name, username, password_hash, created_at
     FROM users WHERE email ILIKE $1`,
    [email],
  );
  if (!rows[0]) return undefined;
  const u = rows[0];
  return {
    id: String(u.id),
    email: u.email,
    name: u.display_name || u.username,
    passwordHash: u.password_hash ?? '',
    createdAt: u.created_at,
  };
}

export async function createUser(user: Omit<User, 'id'>): Promise<{ id: string }> {
  const base = user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 25) || 'user';
  const username = `${base}_${Math.random().toString(36).slice(2, 7)}`;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users
       (email, username, display_name, password_hash, auth_provider, email_verified, is_active)
     VALUES ($1, $2, $3, $4, 'email', TRUE, TRUE)
     RETURNING id`,
    [user.email, username, user.name, user.passwordHash],
  );
  return { id: String(rows[0].id) };
}

export async function getUsers(): Promise<User[]> {
  const { rows } = await db.query<{
    id: string; email: string; display_name: string | null;
    username: string; password_hash: string | null; created_at: string;
  }>(`SELECT id, email, display_name, username, password_hash, created_at FROM users LIMIT 100`);
  return rows.map((u) => ({
    id: String(u.id),
    email: u.email,
    name: u.display_name || u.username,
    passwordHash: u.password_hash ?? '',
    createdAt: u.created_at,
  }));
}
