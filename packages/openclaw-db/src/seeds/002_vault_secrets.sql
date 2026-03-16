-- Seed: Default vault_secrets entries for all API key slots
-- Values are placeholders — overwritten at runtime by VaultBridge sync from Bitwarden
-- Owner: Vesta (secrets-management agent)

BEGIN;

INSERT INTO vault_secrets (name, value, description, owner_agent, acl) VALUES

-- ─── Anthropic ───────────────────────────────────────────────────────────────
(
  'openclaw/api-keys/anthropic',
  'PLACEHOLDER',
  'Anthropic API key — used by Claude agents (Opus, Sonnet, Haiku)',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","atlas","aria","clio","delphi","echo","graphx","juno","luna","socrates","boswell","iris","hermes","vesta"]'::jsonb
),

-- ─── OpenAI ──────────────────────────────────────────────────────────────────
(
  'openclaw/api-keys/openai',
  'PLACEHOLDER',
  'OpenAI API key — used by Felix (gpt-5) and Kairos (gpt-5-mini)',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","felix","kairos"]'::jsonb
),

-- ─── Google / Gemini ─────────────────────────────────────────────────────────
(
  'openclaw/api-keys/google',
  'PLACEHOLDER',
  'Google AI / Gemini API key — used by Helios',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","helios"]'::jsonb
),

-- ─── GitHub ──────────────────────────────────────────────────────────────────
(
  'openclaw/api-keys/github-pat',
  'PLACEHOLDER',
  'GitHub Personal Access Token — used by Juno for project management and issue tracking',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","juno"]'::jsonb
),

-- ─── Fireflies ───────────────────────────────────────────────────────────────
(
  'openclaw/api-keys/fireflies',
  'PLACEHOLDER',
  'Fireflies.ai API key — used by Boswell for meeting transcription and notes',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","boswell","clio"]'::jsonb
),

-- ─── Expensify ───────────────────────────────────────────────────────────────
(
  'openclaw/api-keys/expensify',
  'PLACEHOLDER',
  'Expensify API key — used by Felix for expense management and reporting',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","felix"]'::jsonb
),

-- ─── Gateway Token ───────────────────────────────────────────────────────────
(
  'openclaw/tokens/gateway',
  'PLACEHOLDER',
  'OpenClaw Gateway auth token — used by all agents to authenticate with the internal API gateway',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","atlas","aria","clio","delphi","echo","felix","graphx","helios","juno","kairos","luna","iris","hermes","socrates","vesta","boswell"]'::jsonb
),

-- ─── Device Auth ─────────────────────────────────────────────────────────────
(
  'openclaw/device-auth/tokens',
  'PLACEHOLDER',
  'Device authentication tokens — rotated every 7 days, used for push notification delivery',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","echo","aria"]'::jsonb
),

-- ─── Google OAuth ────────────────────────────────────────────────────────────
(
  'openclaw/oauth/google-client-id',
  'PLACEHOLDER',
  'Google OAuth client ID — used by Helios for Google Calendar and Gmail access',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","helios","aria"]'::jsonb
),
(
  'openclaw/oauth/google-client-secret',
  'PLACEHOLDER',
  'Google OAuth client secret — used by Helios for Google Calendar and Gmail access',
  (SELECT id FROM agents WHERE slug = 'vesta'),
  '["openclaw","helios","aria"]'::jsonb
)

ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  owner_agent = COALESCE(EXCLUDED.owner_agent, vault_secrets.owner_agent),
  acl         = EXCLUDED.acl,
  updated_at  = NOW();

COMMIT;
