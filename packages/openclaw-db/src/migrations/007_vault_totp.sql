-- Migration 007: Add TOTP secret storage to vault_secrets
-- Stores base32-encoded TOTP seeds for 2FA code generation

BEGIN;

ALTER TABLE vault_secrets ADD COLUMN IF NOT EXISTS totp_secret TEXT;

COMMIT;
