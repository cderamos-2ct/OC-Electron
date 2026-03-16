-- Migration 004: Promote vault runtime tables from lazy DDL to managed migrations
-- Moves vault_approvals and rotation_schedules out of application bootstrap code

BEGIN;

-- ============================================================
-- VAULT APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     TEXT NOT NULL,
  secret_name  TEXT NOT NULL,
  purpose      TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at   TIMESTAMPTZ,
  decision     TEXT NOT NULL DEFAULT 'pending'
               CHECK (decision IN ('pending','approved','denied'))
);

-- ============================================================
-- ROTATION SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS rotation_schedules (
  secret_name      TEXT PRIMARY KEY,
  mode             TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('auto','manual')),
  interval_ms      BIGINT NOT NULL,
  last_rotated_at  TIMESTAMPTZ,
  next_rotation_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
