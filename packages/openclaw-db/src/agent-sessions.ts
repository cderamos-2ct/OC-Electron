// ─── Agent Session / Conversation DB Integration Layer ───────────────────────
//
// Repository functions for agents, conversations, and audit_log tables.
// Schema defined in packages/openclaw-db/src/migrations/001_initial_schema.sql.

import { query, withTransaction } from './pool.js';
import type { QueryResultRow } from 'pg';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentStatus = 'active' | 'inactive' | 'paused' | 'error';
export type AgentRole = 'orchestrator' | 'specialist' | 'utility';
export type AgentProvider = 'anthropic' | 'openai' | 'google';

export interface Agent {
  id: string;
  name: string;
  slug: string;
  model: string;
  provider: AgentProvider;
  role: AgentRole;
  persona: string | null;
  system_prompt: string | null;
  capabilities: string[];
  config: Record<string, unknown>;
  status: AgentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface AgentUpsert {
  name: string;
  slug: string;
  model: string;
  provider: AgentProvider;
  role: AgentRole;
  persona?: string | null;
  system_prompt?: string | null;
  capabilities?: string[];
  config?: Record<string, unknown>;
  status?: AgentStatus;
}

export type ConversationDirection = 'inbound' | 'outbound' | 'internal';
export type ConversationRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Conversation {
  id: string;
  agent_id: string | null;
  session_id: string | null;
  channel: string | null;
  direction: ConversationDirection;
  role: ConversationRole;
  content: string;
  metadata: Record<string, unknown>;
  task_id: string | null;
  created_at: Date;
}

export interface ConversationInsert {
  agent_id?: string | null;
  session_id?: string | null;
  channel?: string | null;
  direction: ConversationDirection;
  role: ConversationRole;
  content: string;
  metadata?: Record<string, unknown>;
  task_id?: string | null;
}

export interface AuditLogEntry {
  id: string;
  agent_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  payload: Record<string, unknown>;
  ip_address: string | null;
  created_at: Date;
}

export interface AuditLogInsert {
  agent_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  payload?: Record<string, unknown>;
  ip_address?: string | null;
}

export interface ConversationListOptions {
  agent_id?: string;
  session_id?: string;
  channel?: string;
  limit?: number;
  before?: Date;
}

// ─── Agent Repository ─────────────────────────────────────────────────────────

/**
 * Upsert an agent by slug. Creates if not present, updates all fields otherwise.
 */
export async function upsertAgent(data: AgentUpsert): Promise<Agent> {
  const res = await query<Agent & QueryResultRow>(
    `INSERT INTO agents (name, slug, model, provider, role, persona, system_prompt, capabilities, config, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (slug) DO UPDATE SET
       name          = EXCLUDED.name,
       model         = EXCLUDED.model,
       provider      = EXCLUDED.provider,
       role          = EXCLUDED.role,
       persona       = EXCLUDED.persona,
       system_prompt = EXCLUDED.system_prompt,
       capabilities  = EXCLUDED.capabilities,
       config        = EXCLUDED.config,
       status        = EXCLUDED.status,
       updated_at    = NOW()
     RETURNING *`,
    [
      data.name,
      data.slug,
      data.model,
      data.provider,
      data.role,
      data.persona ?? null,
      data.system_prompt ?? null,
      JSON.stringify(data.capabilities ?? []),
      JSON.stringify(data.config ?? {}),
      data.status ?? 'inactive',
    ]
  );
  return res.rows[0];
}

/**
 * Get an agent by its UUID.
 */
export async function getAgentById(id: string): Promise<Agent | null> {
  const res = await query<Agent & QueryResultRow>(
    `SELECT * FROM agents WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

/**
 * Get an agent by its slug.
 */
export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  const res = await query<Agent & QueryResultRow>(
    `SELECT * FROM agents WHERE slug = $1`,
    [slug]
  );
  return res.rows[0] ?? null;
}

/**
 * List all agents, optionally filtered by status.
 */
export async function listAgents(status?: AgentStatus): Promise<Agent[]> {
  if (status) {
    const res = await query<Agent & QueryResultRow>(
      `SELECT * FROM agents WHERE status = $1 ORDER BY name`,
      [status]
    );
    return res.rows;
  }
  const res = await query<Agent & QueryResultRow>(
    `SELECT * FROM agents ORDER BY name`
  );
  return res.rows;
}

/**
 * Update the status of an agent by id.
 */
export async function setAgentStatus(id: string, status: AgentStatus): Promise<void> {
  await query(
    `UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
}

// ─── Conversation Repository ──────────────────────────────────────────────────

/**
 * Append a single conversation message.
 */
export async function insertConversation(data: ConversationInsert): Promise<Conversation> {
  const res = await query<Conversation & QueryResultRow>(
    `INSERT INTO conversations (agent_id, session_id, channel, direction, role, content, metadata, task_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.agent_id ?? null,
      data.session_id ?? null,
      data.channel ?? null,
      data.direction,
      data.role,
      data.content,
      JSON.stringify(data.metadata ?? {}),
      data.task_id ?? null,
    ]
  );
  return res.rows[0];
}

/**
 * Bulk-insert conversation messages in a single transaction.
 * Useful for writing a full thread snapshot at once.
 */
export async function insertConversationsBatch(messages: ConversationInsert[]): Promise<Conversation[]> {
  if (messages.length === 0) return [];

  return withTransaction(async (client) => {
    const rows: Conversation[] = [];
    for (const msg of messages) {
      const res = await client.query<Conversation & QueryResultRow>(
        `INSERT INTO conversations (agent_id, session_id, channel, direction, role, content, metadata, task_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          msg.agent_id ?? null,
          msg.session_id ?? null,
          msg.channel ?? null,
          msg.direction,
          msg.role,
          msg.content,
          JSON.stringify(msg.metadata ?? {}),
          msg.task_id ?? null,
        ]
      );
      rows.push(res.rows[0]);
    }
    return rows;
  });
}

/**
 * List conversation messages, most recent first.
 */
export async function listConversations(options: ConversationListOptions = {}): Promise<Conversation[]> {
  const { agent_id, session_id, channel, limit = 50, before } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (agent_id) { conditions.push(`agent_id = $${idx++}`); params.push(agent_id); }
  if (session_id) { conditions.push(`session_id = $${idx++}`); params.push(session_id); }
  if (channel) { conditions.push(`channel = $${idx++}`); params.push(channel); }
  if (before) { conditions.push(`created_at < $${idx++}`); params.push(before); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const res = await query<Conversation & QueryResultRow>(
    `SELECT * FROM conversations ${where} ORDER BY created_at DESC LIMIT $${idx}`,
    params
  );
  return res.rows;
}

/**
 * Get all messages for a session ordered chronologically (oldest first).
 * Suitable for reconstructing a thread to pass to an LLM.
 */
export async function getSessionThread(session_id: string, limit = 200): Promise<Conversation[]> {
  const res = await query<Conversation & QueryResultRow>(
    `SELECT * FROM conversations
     WHERE session_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [session_id, limit]
  );
  return res.rows;
}

/**
 * Get unique session ids for an agent, newest first.
 */
export async function getAgentSessions(agent_id: string, limit = 20): Promise<string[]> {
  const res = await query<{ session_id: string } & QueryResultRow>(
    `SELECT session_id
     FROM conversations
     WHERE agent_id = $1 AND session_id IS NOT NULL
     GROUP BY session_id
     ORDER BY MAX(created_at) DESC
     LIMIT $2`,
    [agent_id, limit]
  );
  return res.rows.map((r) => r.session_id);
}

// ─── Audit Log Repository ────────────────────────────────────────────────────

/**
 * Append an audit log entry. Fire-and-forget safe: errors are surfaced to caller.
 */
export async function insertAuditLog(entry: AuditLogInsert): Promise<AuditLogEntry> {
  const res = await query<AuditLogEntry & QueryResultRow>(
    `INSERT INTO audit_log (agent_id, action, resource_type, resource_id, payload, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6::inet)
     RETURNING *`,
    [
      entry.agent_id ?? null,
      entry.action,
      entry.resource_type ?? null,
      entry.resource_id ?? null,
      JSON.stringify(entry.payload ?? {}),
      entry.ip_address ?? null,
    ]
  );
  return res.rows[0];
}

/**
 * List recent audit log entries for a resource.
 */
export async function listAuditLog(
  resourceType: string,
  resourceId?: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  if (resourceId) {
    const res = await query<AuditLogEntry & QueryResultRow>(
      `SELECT * FROM audit_log
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [resourceType, resourceId, limit]
    );
    return res.rows;
  }

  const res = await query<AuditLogEntry & QueryResultRow>(
    `SELECT * FROM audit_log
     WHERE resource_type = $1
     ORDER BY created_at DESC LIMIT $2`,
    [resourceType, limit]
  );
  return res.rows;
}
