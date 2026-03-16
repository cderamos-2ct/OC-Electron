# OpenClaw Database Schema

Postgres 16 with `pgcrypto` and `vector` (pgvector) extensions.

Migrations live in `src/migrations/` and are applied in numeric order.

---

## Extensions

| Extension | Purpose |
|-----------|---------|
| `pgcrypto` | `gen_random_uuid()`, symmetric encryption via `pgp_sym_encrypt` / `pgp_sym_decrypt` |
| `vector` | pgvector — 1536-dimensional cosine-similarity embeddings |

---

## Tables

### `agents`

Registry of all AI agents in the system.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `name` | TEXT UNIQUE NOT NULL | Display name (e.g. "CD") |
| `slug` | TEXT UNIQUE NOT NULL | URL-safe identifier (e.g. "cd") |
| `model` | TEXT NOT NULL | Model ID (e.g. `claude-sonnet-4.6`) |
| `provider` | TEXT NOT NULL | `anthropic` \| `openai` \| `google` |
| `role` | TEXT NOT NULL | `orchestrator` \| `specialist` \| `utility` |
| `persona` | TEXT | Free-text persona/voice description |
| `system_prompt` | TEXT | Base system prompt injected at runtime |
| `capabilities` | JSONB `[]` | Array of capability tags |
| `config` | JSONB `{}` | Arbitrary agent config blob |
| `status` | TEXT | `active` \| `inactive` \| `paused` \| `error` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

---

### `tasks`

Work items assigned to agents. Supports parent/child hierarchy.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `status` | TEXT | `pending` \| `in_progress` \| `completed` \| `failed` \| `cancelled` |
| `priority` | INTEGER | Default 0; higher = more urgent |
| `assigned_to` | UUID → `agents.id` | |
| `created_by` | UUID → `agents.id` | |
| `parent_task` | UUID → `tasks.id` | Cascades on delete |
| `metadata` | JSONB `{}` | |
| `due_at` | TIMESTAMPTZ | |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

---

### `conversations`

Message log for all agent conversations across channels.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `agent_id` | UUID → `agents.id` | Nullable |
| `session_id` | TEXT | Runtime session key |
| `channel` | TEXT | `slack` \| `imessage` \| `email` \| `internal` |
| `direction` | TEXT | `inbound` \| `outbound` \| `internal` |
| `role` | TEXT | `user` \| `assistant` \| `system` \| `tool` |
| `content` | TEXT NOT NULL | |
| `metadata` | JSONB `{}` | |
| `task_id` | UUID → `tasks.id` | Optional linkage |
| `created_at` | TIMESTAMPTZ | |

---

### `embeddings`

Semantic vector embeddings for RAG (retrieval-augmented generation).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `source_type` | TEXT NOT NULL | `conversation` \| `task` \| `file` \| `note` |
| `source_id` | UUID NOT NULL | FK to the source record (soft — not enforced) |
| `content` | TEXT NOT NULL | The text that was embedded |
| `embedding` | vector(1536) NOT NULL | 1536-dim float vector (OpenAI/Anthropic compatible) |
| `model` | TEXT | Default `text-embedding-3-small` |
| `metadata` | JSONB `{}` | |
| `created_at` | TIMESTAMPTZ | |

**Index:** `embeddings_vector_idx` — IVFFlat cosine ops, 100 lists. Use `ORDER BY embedding <=> $1 LIMIT k` for nearest-neighbour queries.

---

### `audit_log`

Immutable append-only log of all significant agent actions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `agent_id` | UUID → `agents.id` | Nullable |
| `action` | TEXT NOT NULL | Verb (e.g. `secret.read`, `task.complete`) |
| `resource_type` | TEXT | Entity type acted upon |
| `resource_id` | UUID | Entity ID acted upon |
| `payload` | JSONB `{}` | Action-specific data |
| `ip_address` | INET | Origin if applicable |
| `created_at` | TIMESTAMPTZ | |

---

### `vault_secrets`

Encrypted secret storage. Values are encrypted at rest.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT UNIQUE NOT NULL | Secret key (e.g. `OPENAI_API_KEY`) |
| `value` | TEXT NOT NULL | Legacy plaintext column (migrate to `encrypted_value`) |
| `encrypted_value` | BYTEA | pgp_sym_encrypt ciphertext (added in migration 003) |
| `description` | TEXT | |
| `owner_agent` | UUID → `agents.id` | Agent that owns the secret |
| `acl` | JSONB `[]` | List of agent slugs permitted to read |
| `rotated_at` | TIMESTAMPTZ | Last rotation timestamp |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

**Encryption helpers** (defined in migration 003, `SECURITY DEFINER`):
- `vault_encrypt(plaintext TEXT, key TEXT) → BYTEA` — wraps `pgp_sym_encrypt`
- `vault_decrypt(ciphertext BYTEA, key TEXT) → TEXT` — wraps `pgp_sym_decrypt`

Pass `VAULT_MASTER_KEY` env var as the `key` argument.

---

### `vault_approvals`

Tracks agent requests to access secrets, with human-in-the-loop decisions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `agent_id` | TEXT NOT NULL | Requesting agent slug |
| `secret_name` | TEXT NOT NULL | Name of the requested secret |
| `purpose` | TEXT | Why the agent needs the secret |
| `requested_at` | TIMESTAMPTZ | |
| `decided_at` | TIMESTAMPTZ | When the decision was made |
| `decision` | TEXT | `pending` \| `approved` \| `denied` |

---

### `rotation_schedules`

Defines automatic or manual rotation cadences for secrets.

| Column | Type | Notes |
|--------|------|-------|
| `secret_name` | TEXT PK | References `vault_secrets.name` (soft) |
| `mode` | TEXT | `auto` \| `manual` |
| `interval_ms` | BIGINT | Rotation interval in milliseconds |
| `last_rotated_at` | TIMESTAMPTZ | |
| `next_rotation_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### `files`

File metadata. Actual bytes stored externally (S3 / local path via `storage_url`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | Filename |
| `path` | TEXT | Relative path hint |
| `mime_type` | TEXT | |
| `size_bytes` | BIGINT | |
| `storage_url` | TEXT | External URL or local path |
| `uploaded_by` | UUID → `agents.id` | |
| `metadata` | JSONB `{}` | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

---

### `notifications`

In-app notifications delivered to agents.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `recipient` | UUID → `agents.id` CASCADE DELETE | |
| `type` | TEXT | `alert` \| `task_update` \| `message` \| `system` |
| `title` | TEXT NOT NULL | |
| `body` | TEXT | |
| `read` | BOOLEAN | Default false |
| `metadata` | JSONB `{}` | |
| `created_at` | TIMESTAMPTZ | |

---

### `user_preferences`

Per-agent UI and notification preferences.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `agent_id` | UUID → `agents.id` UNIQUE CASCADE DELETE | |
| `theme` | TEXT | `system` \| `light` \| `dark` |
| `notifications` | JSONB | `{"push": true, "email": false}` |
| `timezone` | TEXT | Default `America/Los_Angeles` |
| `preferences` | JSONB `{}` | Arbitrary preferences bag |
| `updated_at` | TIMESTAMPTZ | |

---

### `gmail_messages`

Polled Gmail messages persisted for agent consumption.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Gmail message ID |
| `thread_id` | TEXT NOT NULL | |
| `label_ids` | TEXT[] | |
| `snippet` | TEXT | |
| `from_address` | TEXT | |
| `to_address` | TEXT | |
| `subject` | TEXT | |
| `date` | TEXT | RFC 2822 date string |
| `body` | TEXT | Full message body |
| `polled_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

**Indexes:** `gmail_messages_thread_id_idx`, `gmail_messages_polled_at_idx`

---

### `calendar_events`

Polled Google Calendar events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Google Calendar event ID |
| `summary` | TEXT | Event title |
| `description` | TEXT | |
| `location` | TEXT | |
| `start_time` | TEXT | ISO 8601 |
| `end_time` | TEXT | ISO 8601 |
| `attendees` | JSONB | Array of `{email, responseStatus}` |
| `status` | TEXT | `confirmed` \| `tentative` \| `cancelled` |
| `html_link` | TEXT | |
| `calendar_id` | TEXT | Default `primary` |
| `polled_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

**Indexes:** `calendar_events_start_time_idx`, `calendar_events_polled_at_idx`

---

### `github_notifications`

Polled GitHub notification threads.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | GitHub notification thread ID |
| `reason` | TEXT | Why the notification was triggered |
| `subject` | JSONB | `{title, url, type}` |
| `repository` | TEXT | `owner/repo` full name |
| `updated_at_gh` | TEXT | GitHub's own `updated_at` timestamp |
| `unread` | BOOLEAN | Default true |
| `polled_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

**Indexes:** `github_notifications_unread_idx` (partial, `WHERE unread = true`), `github_notifications_polled_at_idx`

---

## Triggers

`set_updated_at()` — a `BEFORE UPDATE` trigger function defined in migration 001 that sets `NEW.updated_at = NOW()`. Applied to: `agents`, `tasks`, `vault_secrets`, `files`, `gmail_messages`, `calendar_events`, `github_notifications`.

---

## Migration History

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables: agents, tasks, conversations, embeddings, audit_log, vault_secrets, files, notifications, user_preferences |
| `002_api_worker_tables.sql` | Polling tables: gmail_messages, calendar_events, github_notifications |
| `003_vault_encryption.sql` | Adds `encrypted_value BYTEA` to vault_secrets; defines `vault_encrypt` / `vault_decrypt` helpers |
| `004_vault_runtime_tables.sql` | Promotes vault_approvals and rotation_schedules from lazy DDL to managed migrations |

---

## PGVector Usage

The `embeddings` table stores 1536-dimensional vectors compatible with:
- OpenAI `text-embedding-3-small` / `text-embedding-3-large`
- Anthropic voyage embeddings

Nearest-neighbour search (cosine similarity):

```sql
SELECT source_type, source_id, content, 1 - (embedding <=> $1) AS score
FROM embeddings
ORDER BY embedding <=> $1
LIMIT 10;
```

The IVFFlat index (`lists = 100`) accelerates approximate search at the cost of slight recall loss. For exact search, drop the index and use a sequential scan on small datasets.

---

## RLS Policy Overview

Row-level security is not yet enforced at the Postgres layer — access control is handled at the application level via the `vault_secrets.acl` JSONB column (agent slug allowlist) and `vault_approvals` workflow. All agents connect through the shared pool defined in `packages/openclaw-db/src/pool.ts` using a single service-role credential (`DB_USER` / `DB_PASSWORD`).
