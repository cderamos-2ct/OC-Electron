-- Migration 001: Initial OpenClaw schema
-- Postgres 16 + pgvector

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- AGENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  slug          TEXT NOT NULL UNIQUE,
  model         TEXT NOT NULL,               -- e.g. claude-opus-4-6
  provider      TEXT NOT NULL,               -- anthropic | openai | google
  role          TEXT NOT NULL,               -- orchestrator | specialist | utility
  persona       TEXT,
  system_prompt TEXT,
  capabilities  JSONB NOT NULL DEFAULT '[]',
  config        JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','paused','error')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
  priority      INTEGER NOT NULL DEFAULT 0,
  assigned_to   UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES agents(id) ON DELETE SET NULL,
  parent_task   UUID REFERENCES tasks(id) ON DELETE CASCADE,
  metadata      JSONB NOT NULL DEFAULT '{}',
  due_at        TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES agents(id) ON DELETE SET NULL,
  session_id    TEXT,
  channel       TEXT,                        -- slack | imessage | email | internal
  direction     TEXT NOT NULL CHECK (direction IN ('inbound','outbound','internal')),
  role          TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content       TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EMBEDDINGS (pgvector, 1536-dim for OpenAI/Anthropic)
-- ============================================================
CREATE TABLE IF NOT EXISTS embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type   TEXT NOT NULL,               -- conversation | task | file | note
  source_id     UUID NOT NULL,
  content       TEXT NOT NULL,
  embedding     vector(1536) NOT NULL,
  model         TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embeddings_vector_idx
  ON embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES agents(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  payload       JSONB NOT NULL DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VAULT SECRETS
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_secrets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  value         TEXT NOT NULL,               -- encrypted at rest via pgcrypto or app-level AES
  description   TEXT,
  owner_agent   UUID REFERENCES agents(id) ON DELETE SET NULL,
  acl           JSONB NOT NULL DEFAULT '[]', -- list of agent slugs that can read
  rotated_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FILES
-- ============================================================
CREATE TABLE IF NOT EXISTS files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  path          TEXT,
  mime_type     TEXT,
  size_bytes    BIGINT,
  storage_url   TEXT,
  uploaded_by   UUID REFERENCES agents(id) ON DELETE SET NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient     UUID REFERENCES agents(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,               -- alert | task_update | message | system
  title         TEXT NOT NULL,
  body          TEXT,
  read          BOOLEAN NOT NULL DEFAULT false,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  theme         TEXT NOT NULL DEFAULT 'system',
  notifications JSONB NOT NULL DEFAULT '{"push":true,"email":false}',
  timezone      TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  preferences   JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER vault_secrets_updated_at
  BEFORE UPDATE ON vault_secrets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER files_updated_at
  BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
