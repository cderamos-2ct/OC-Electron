-- Migration 005: Add folder column to vault_secrets for categorization
-- Replaces Bitwarden folder concept with a direct column

BEGIN;

ALTER TABLE vault_secrets ADD COLUMN IF NOT EXISTS folder TEXT;

-- Backfill from name prefix convention (openclaw/api-keys/github-pat → openclaw/api-keys)
UPDATE vault_secrets
SET folder = regexp_replace(name, '/[^/]+$', '')
WHERE folder IS NULL AND name LIKE '%/%';

CREATE INDEX IF NOT EXISTS idx_vault_secrets_folder ON vault_secrets(folder);

COMMIT;
