import { Pool } from 'pg';

// Prevent multiple Pool instances during Next.js hot-reload in development
const g = global as typeof global & { _pgPool?: Pool };

export const db =
  g._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon / most managed Postgres providers require SSL in production
    ssl: process.env.DATABASE_URL?.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') g._pgPool = db;

// Auto-create table on first use
let ready = false;
export async function ensureSchema() {
  if (ready) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      model_id    TEXT NOT NULL,
      provider    TEXT NOT NULL,
      messages    JSONB NOT NULL DEFAULT '[]',
      starred     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS conversations_user_updated
      ON conversations (user_id, updated_at DESC);
  `);
  ready = true;
}
