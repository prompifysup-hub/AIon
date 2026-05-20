import { Pool } from 'pg';

const g = global as typeof global & { _pgPool?: Pool };

export const db =
  g._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') g._pgPool = db;

let ready = false;

export async function ensureSchema() {
  if (ready) return;

  // Flat conversation history (existing)
  await db.query(`
    CREATE TABLE IF NOT EXISTS aion_conversations (
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
    CREATE INDEX IF NOT EXISTS aion_conversations_user_updated
      ON aion_conversations (user_id, updated_at DESC);
  `);

  // Simple message feedback (no FK to relational messages table)
  await db.query(`
    CREATE TABLE IF NOT EXISTS aion_message_feedback (
      id               BIGSERIAL PRIMARY KEY,
      user_id          TEXT NOT NULL,
      conversation_id  TEXT NOT NULL,
      message_uuid     TEXT NOT NULL,
      rating           SMALLINT NOT NULL,
      feedback_text    TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, message_uuid)
    );
    CREATE INDEX IF NOT EXISTS idx_aion_feedback_conv
      ON aion_message_feedback (conversation_id);
  `);

  // Invite tokens for organizations
  await db.query(`
    CREATE TABLE IF NOT EXISTS organization_invites (
      id          BIGSERIAL PRIMARY KEY,
      org_id      BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      created_by  BIGINT NOT NULL REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(token);
    CREATE INDEX IF NOT EXISTS idx_org_invites_org   ON organization_invites(org_id);
  `);

  await seedData();
  ready = true;
}

async function seedData() {
  // ── LLM Providers ──────────────────────────────────────────────────────
  await db.query(`
    INSERT INTO llm_providers (name, slug, api_base_url, is_active) VALUES
      ('Google',     'google',     'https://generativelanguage.googleapis.com', TRUE),
      ('OpenRouter',  'openrouter', 'https://openrouter.ai/api/v1',             TRUE),
      ('DeepSeek',    'deepseek',   'https://api.deepseek.com',                 TRUE),
      ('Qwen',        'qwen',       'https://dashscope.aliyuncs.com/compatible-mode/v1', TRUE)
    ON CONFLICT (slug) DO NOTHING
  `);

  // ── LLM Models ─────────────────────────────────────────────────────────
  const { rows: providers } = await db.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM llm_providers`
  );
  const provMap = Object.fromEntries(providers.map((p) => [p.slug, p.id]));

  if (provMap.google) {
    await db.query(
      `INSERT INTO llm_models
         (provider_id, name, slug, display_name, context_window, credits_per_message, supports_streaming, is_active)
       VALUES
         ($1, 'Gemini 2.5 Flash', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 1000000, 1, TRUE, TRUE),
         ($1, 'Gemini 2.5 Pro',   'gemini-2.5-pro',   'Gemini 2.5 Pro',   1000000, 2, TRUE, TRUE)
       ON CONFLICT (slug) DO NOTHING`,
      [provMap.google],
    );
  }
  if (provMap.openrouter) {
    await db.query(
      `INSERT INTO llm_models
         (provider_id, name, slug, display_name, context_window, credits_per_message, supports_streaming, is_active)
       VALUES
         ($1, 'GPT-4o Mini',       'openai/gpt-4o-mini',              'GPT-4o Mini',       128000, 1, TRUE, TRUE),
         ($1, 'Claude 3 Haiku',    'anthropic/claude-3-haiku',        'Claude 3 Haiku',    200000, 1, TRUE, TRUE),
         ($1, 'Llama 3.1 8B',      'meta-llama/llama-3.1-8b-instruct','Llama 3.1 8B',     128000, 1, TRUE, TRUE)
       ON CONFLICT (slug) DO NOTHING`,
      [provMap.openrouter],
    );
  }
  if (provMap.deepseek) {
    await db.query(
      `INSERT INTO llm_models
         (provider_id, name, slug, display_name, context_window, credits_per_message, supports_streaming, is_active)
       VALUES
         ($1, 'DeepSeek Chat', 'deepseek-chat', 'DeepSeek Chat', 64000, 1, TRUE, TRUE)
       ON CONFLICT (slug) DO NOTHING`,
      [provMap.deepseek],
    );
  }

  // ── System Bots ────────────────────────────────────────────────────────
  const { rows: modelRows } = await db.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM llm_models`
  );
  const modelMap = Object.fromEntries(modelRows.map((m) => [m.slug, m.id]));
  const flashId = modelMap['gemini-2.5-flash'];

  const systemBots = [
    { slug: 'gemini-flash',    name: 'Gemini Flash',    desc: 'Fast & efficient for quick tasks',           icon: '⚡', category: 'text',  prompt: 'You are a fast and efficient AI assistant. Provide concise, direct, helpful responses.', badge: 'Fast' },
    { slug: 'gemini-balanced', name: 'Gemini Balanced', desc: 'Thoughtful answers for everyday tasks',      icon: '🌟', category: 'text',  prompt: 'You are a thoughtful and balanced AI assistant. Provide clear, well-structured, comprehensive responses.', badge: 'Popular' },
    { slug: 'gemini-pro',      name: 'Gemini Pro',      desc: 'Deep reasoning for complex problems',        icon: '🧠', category: 'text',  prompt: 'You are an advanced AI assistant with strong reasoning. Think step by step and provide deep, nuanced responses.', badge: 'Pro' },
    { slug: 'code-assistant',  name: 'Code Assistant',  desc: 'Specialized for programming',                icon: '💻', category: 'text',  prompt: 'You are a specialized coding assistant. Help with programming, debugging, code review, and architecture. Always provide working code examples with markdown code blocks.', badge: null },
    { slug: 'creative-writer', name: 'Creative Writer', desc: 'Stories, poems & creative content',         icon: '✍️', category: 'text',  prompt: 'You are a creative writing assistant. Help craft compelling stories, poems, scripts, and creative content.', badge: null },
    { slug: 'analyst',         name: 'Data Analyst',    desc: 'Analysis, research & insights',              icon: '📊', category: 'text',  prompt: 'You are a data analyst and research assistant. Analyze data, research topics, identify trends, and present findings clearly.', badge: null },
    { slug: 'image-creator',   name: 'Image Creator',   desc: 'Generate images from text prompts',          icon: '🎨', category: 'image', prompt: '', badge: 'New' },
  ];

  for (const bot of systemBots) {
    await db.query(
      `INSERT INTO bots
         (model_id, name, slug, description, avatar_url, system_prompt, is_system_bot, is_public, is_active, category, credits_per_message)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, TRUE, $7, 1)
       ON CONFLICT (slug) DO NOTHING`,
      [flashId ?? null, bot.name, bot.slug, bot.desc, bot.icon, bot.prompt, bot.category],
    );
  }
}
