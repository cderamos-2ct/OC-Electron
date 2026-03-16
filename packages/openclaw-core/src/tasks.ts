// ─── Task Types ─────────────────────────────────────────────────────────────

export type QuickDecision = 'approve' | 'defer' | 'block' | 'cancel';

export type TaskPatch = {
  status?: string;
  priority?: string;
  owner_agent?: string;
  reason?: string;
  expectedUpdatedAt?: string; // optimistic locking
};

export type TaskDocument = {
  id: string;
  title: string;
  status: string;
  priority: string;
  owner_agent: string;
  agent_type: string;
  created_at: string;
  updated_at: string;
  source: string;
  depends_on: string[];
  blocked_by: string[];
  tags: string[];
  artifacts: string[];
  description: string;
  currentState: string;
  acceptance: string;
  activityLog: string[];
  notes: string;
  sections: Record<string, string>;
  rawContent: string;
};

export type TaskConflict = {
  conflict: true;
  currentTask: TaskDocument;
};

export type TaskStateBucket = {
  key: 'current' | 'pending' | 'blocked' | 'complete';
  label: string;
  description: string;
  tasks: import('./agents.js').AgentTaskSummary[];
  total: number;
};

export type OpsTaskLike = {
  id: string;
  title: string;
  description?: string;
  content?: string;
  status: string;
  priority: string;
  assignee?: string | null;
  updatedAt: string;
};
