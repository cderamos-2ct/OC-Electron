-- Migration 006: URL-to-credential mapping for browser auto-fill
-- Maps domains/URL patterns to vault secrets for webview auto-fill

BEGIN;

CREATE TABLE IF NOT EXISTS vault_credential_urls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name  TEXT NOT NULL REFERENCES vault_secrets(name) ON DELETE CASCADE,
  url_pattern  TEXT NOT NULL,         -- domain or glob (e.g. "github.com", "*.google.com")
  username     TEXT,                  -- optional username to fill alongside password
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcurl_pattern ON vault_credential_urls(url_pattern);
CREATE INDEX IF NOT EXISTS idx_vcurl_secret_name ON vault_credential_urls(secret_name);

COMMIT;
