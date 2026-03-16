-- Migration 002: API Worker persistence tables
-- Gmail messages, calendar events, GitHub notifications polled by background workers

BEGIN;

-- ============================================================
-- GMAIL MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS gmail_messages (
  id              TEXT PRIMARY KEY,               -- Gmail message ID
  thread_id       TEXT NOT NULL,
  label_ids       TEXT[] NOT NULL DEFAULT '{}',
  snippet         TEXT NOT NULL DEFAULT '',
  from_address    TEXT NOT NULL DEFAULT '',
  to_address      TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL DEFAULT '',
  date            TEXT NOT NULL DEFAULT '',
  body            TEXT,
  polled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gmail_messages_thread_id_idx ON gmail_messages (thread_id);
CREATE INDEX IF NOT EXISTS gmail_messages_polled_at_idx ON gmail_messages (polled_at DESC);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id              TEXT PRIMARY KEY,               -- Google Calendar event ID
  summary         TEXT NOT NULL DEFAULT '(no title)',
  description     TEXT,
  location        TEXT,
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL,
  attendees       JSONB NOT NULL DEFAULT '[]',    -- [{email, responseStatus}]
  status          TEXT NOT NULL DEFAULT 'confirmed',
  html_link       TEXT NOT NULL DEFAULT '',
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  polled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_events_start_time_idx ON calendar_events (start_time);
CREATE INDEX IF NOT EXISTS calendar_events_polled_at_idx ON calendar_events (polled_at DESC);

-- ============================================================
-- GITHUB NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS github_notifications (
  id              TEXT PRIMARY KEY,               -- GitHub notification thread ID
  reason          TEXT NOT NULL DEFAULT '',
  subject         JSONB NOT NULL DEFAULT '{}',    -- {title, url, type}
  repository      TEXT NOT NULL DEFAULT '',       -- full_name e.g. "owner/repo"
  updated_at_gh   TEXT NOT NULL DEFAULT '',       -- GitHub's updated_at timestamp
  unread          BOOLEAN NOT NULL DEFAULT true,
  polled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS github_notifications_unread_idx ON github_notifications (unread) WHERE unread = true;
CREATE INDEX IF NOT EXISTS github_notifications_polled_at_idx ON github_notifications (polled_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
-- set_updated_at function already defined in 001_initial_schema.sql

CREATE OR REPLACE TRIGGER gmail_messages_updated_at
  BEFORE UPDATE ON gmail_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER github_notifications_updated_at
  BEFORE UPDATE ON github_notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
