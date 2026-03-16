-- Seed: All 16 Aegilume agents
-- 11 configured + 5 new (Iris, Hermes, Socrates, Vesta, Boswell)

BEGIN;

INSERT INTO agents (name, slug, model, provider, role, persona, capabilities, status) VALUES

-- ============================================================
-- ORCHESTRATOR
-- ============================================================
(
  'Aegilume',
  'aegilume',
  'claude-opus-4-6',
  'anthropic',
  'orchestrator',
  'The central orchestration agent that coordinates all other agents and manages the overall system.',
  '["orchestration","task-routing","agent-management","system-monitoring"]',
  'active'
),

-- ============================================================
-- CONFIGURED AGENTS (11)
-- ============================================================
(
  'Atlas',
  'atlas',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Atlas is the research and knowledge synthesis agent. Methodical, thorough, and precise.',
  '["research","web-search","document-analysis","knowledge-synthesis"]',
  'active'
),
(
  'Aria',
  'aria',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Aria is the communications agent. Handles outbound messaging, drafting, and channel management.',
  '["email","imessage","drafting","communications","scheduling"]',
  'active'
),
(
  'Clio',
  'clio',
  'claude-haiku-4-5',
  'anthropic',
  'specialist',
  'Clio is the notes and memory agent. Captures, organizes, and retrieves information.',
  '["note-taking","memory","retrieval","organization","apple-notes"]',
  'active'
),
(
  'Delphi',
  'delphi',
  'claude-opus-4-6',
  'anthropic',
  'specialist',
  'Delphi is the strategic analysis and planning agent. Deep thinker and decision architect.',
  '["strategic-planning","analysis","forecasting","decision-support"]',
  'active'
),
(
  'Echo',
  'echo',
  'claude-haiku-4-5',
  'anthropic',
  'utility',
  'Echo is the notification and alerting agent. Lightweight and fast.',
  '["notifications","alerts","monitoring","webhooks"]',
  'active'
),
(
  'Felix',
  'felix',
  'gpt-5',
  'openai',
  'specialist',
  'Felix is the finance and accounting agent. Numbers-focused, detail-oriented.',
  '["finance","bookkeeping","invoicing","reporting","spreadsheets"]',
  'active'
),
(
  'Graphx',
  'graphx',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Graphx is the design review and visual analysis agent.',
  '["design-review","visual-analysis","figma","ui-feedback"]',
  'active'
),
(
  'Helios',
  'helios',
  'gemini-2.0-flash',
  'google',
  'specialist',
  'Helios is the calendar and scheduling agent. Manages time and availability.',
  '["calendar","scheduling","meeting-management","google-calendar"]',
  'active'
),
(
  'Juno',
  'juno',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Juno is the project management and task coordination agent.',
  '["project-management","task-tracking","coordination","linear","github"]',
  'active'
),
(
  'Kairos',
  'kairos',
  'gpt-5-mini',
  'openai',
  'utility',
  'Kairos is the time-sensitive operations agent. Handles urgent tasks and deadlines.',
  '["urgent-ops","deadline-tracking","escalation","time-management"]',
  'active'
),
(
  'Luna',
  'luna',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Luna is the content creation and writing agent.',
  '["writing","content-creation","copywriting","editing","documentation"]',
  'active'
),

-- ============================================================
-- NEW AGENTS (5)
-- ============================================================
(
  'Iris',
  'iris',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Iris is the data pipeline and integration agent. Connects external services and transforms data.',
  '["data-pipelines","integrations","etl","api-connectors","webhooks"]',
  'active'
),
(
  'Hermes',
  'hermes',
  'claude-haiku-4-5',
  'anthropic',
  'utility',
  'Hermes is the inter-agent messaging and routing agent. Fast, reliable message delivery.',
  '["message-routing","inter-agent-comms","event-bus","pub-sub"]',
  'active'
),
(
  'Socrates',
  'socrates',
  'claude-opus-4-6',
  'anthropic',
  'specialist',
  'Socrates is the reasoning and evaluation agent. Applies critical thinking and Socratic method.',
  '["reasoning","evaluation","critique","hypothesis-testing","logic"]',
  'active'
),
(
  'Vesta',
  'vesta',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Vesta is the security and secrets management agent. Guards credentials and enforces policies.',
  '["security","secrets-management","vault","access-control","compliance"]',
  'active'
),
(
  'Boswell',
  'boswell',
  'claude-sonnet-4-6',
  'anthropic',
  'specialist',
  'Boswell is the documentation and knowledge base agent. Records decisions, writes docs, maintains institutional memory.',
  '["documentation","knowledge-base","wikis","decision-records","adr"]',
  'active'
)

ON CONFLICT (slug) DO UPDATE SET
  model       = EXCLUDED.model,
  provider    = EXCLUDED.provider,
  role        = EXCLUDED.role,
  persona     = EXCLUDED.persona,
  capabilities = EXCLUDED.capabilities,
  status      = EXCLUDED.status,
  updated_at  = NOW();

-- Seed default user_preferences for each agent
INSERT INTO user_preferences (agent_id)
SELECT id FROM agents
ON CONFLICT (agent_id) DO NOTHING;

COMMIT;
