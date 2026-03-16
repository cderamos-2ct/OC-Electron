-- Migration 003: Vault secrets encryption at rest
-- Adds encrypted_value BYTEA column and helper functions using pgcrypto
-- pgcrypto is already enabled in 001_initial_schema.sql

BEGIN;

-- ============================================================
-- VAULT ENCRYPT / DECRYPT HELPER FUNCTIONS
-- ============================================================

-- vault_encrypt: symmetric encrypt a plaintext value using pgp_sym_encrypt
-- Pass VAULT_MASTER_KEY as the key argument
CREATE OR REPLACE FUNCTION vault_encrypt(plaintext TEXT, key TEXT)
RETURNS BYTEA AS $$
  SELECT pgp_sym_encrypt(plaintext, key)::BYTEA;
$$ LANGUAGE SQL STRICT VOLATILE SECURITY DEFINER;

-- vault_decrypt: symmetric decrypt an encrypted BYTEA value
-- Pass VAULT_MASTER_KEY as the key argument
CREATE OR REPLACE FUNCTION vault_decrypt(ciphertext BYTEA, key TEXT)
RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(ciphertext, key);
$$ LANGUAGE SQL STRICT IMMUTABLE SECURITY DEFINER;

-- ============================================================
-- ADD encrypted_value COLUMN TO vault_secrets
-- ============================================================

ALTER TABLE vault_secrets
  ADD COLUMN IF NOT EXISTS encrypted_value BYTEA;

COMMIT;
