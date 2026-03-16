-- Row Level Security policies for OpenClaw
-- Each agent connects with its slug as the app.current_agent setting

BEGIN;

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Helper: get current agent's UUID from the session variable
CREATE OR REPLACE FUNCTION current_agent_id() RETURNS UUID AS $$
  SELECT id FROM agents WHERE slug = current_setting('app.current_agent', true)
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_agent_slug() RETURNS TEXT AS $$
  SELECT current_setting('app.current_agent', true)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_agent_role() RETURNS TEXT AS $$
  SELECT role FROM agents WHERE slug = current_setting('app.current_agent', true)
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- AGENTS — orchestrators see all; specialists see own row + others' public fields
-- ============================================================
CREATE POLICY agents_orchestrator_all ON agents
  FOR ALL
  USING (current_agent_role() = 'orchestrator');

CREATE POLICY agents_self ON agents
  FOR SELECT
  USING (slug = current_agent_slug() OR current_agent_role() IN ('orchestrator'));

-- ============================================================
-- TASKS — agents see tasks assigned to them or created by them
-- ============================================================
CREATE POLICY tasks_own ON tasks
  FOR ALL
  USING (
    assigned_to = current_agent_id()
    OR created_by = current_agent_id()
    OR current_agent_role() = 'orchestrator'
  );

-- ============================================================
-- CONVERSATIONS — agents see their own conversations
-- ============================================================
CREATE POLICY conversations_own ON conversations
  FOR ALL
  USING (
    agent_id = current_agent_id()
    OR current_agent_role() = 'orchestrator'
  );

-- ============================================================
-- EMBEDDINGS — agents see embeddings they created; orchestrators see all
-- ============================================================
CREATE POLICY embeddings_own ON embeddings
  FOR ALL
  USING (current_agent_role() = 'orchestrator');

CREATE POLICY embeddings_read_all ON embeddings
  FOR SELECT
  USING (true); -- embeddings are read-shared for similarity search

-- ============================================================
-- AUDIT LOG — append-only for agents; orchestrators can read all
-- ============================================================
CREATE POLICY audit_insert ON audit_log
  FOR INSERT
  WITH CHECK (agent_id = current_agent_id() OR current_agent_role() = 'orchestrator');

CREATE POLICY audit_read_orchestrator ON audit_log
  FOR SELECT
  USING (
    agent_id = current_agent_id()
    OR current_agent_role() = 'orchestrator'
  );

-- ============================================================
-- VAULT SECRETS — ACL-based: agent slug must appear in acl array
-- ============================================================
CREATE POLICY vault_acl ON vault_secrets
  FOR SELECT
  USING (
    owner_agent = current_agent_id()
    OR acl ? current_agent_slug()
    OR current_agent_role() = 'orchestrator'
  );

CREATE POLICY vault_owner_write ON vault_secrets
  FOR ALL
  USING (
    owner_agent = current_agent_id()
    OR current_agent_role() = 'orchestrator'
  );

-- ============================================================
-- FILES — agents see files they uploaded; orchestrators see all
-- ============================================================
CREATE POLICY files_own ON files
  FOR ALL
  USING (
    uploaded_by = current_agent_id()
    OR current_agent_role() = 'orchestrator'
  );

-- ============================================================
-- NOTIFICATIONS — agents only see their own notifications
-- ============================================================
CREATE POLICY notifications_own ON notifications
  FOR ALL
  USING (recipient = current_agent_id());

-- ============================================================
-- USER PREFERENCES — agents only manage their own preferences
-- ============================================================
CREATE POLICY preferences_own ON user_preferences
  FOR ALL
  USING (agent_id = current_agent_id());

COMMIT;
