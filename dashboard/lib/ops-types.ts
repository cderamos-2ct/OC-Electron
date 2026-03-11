export type OpsTaskStatus = "new" | "in-progress" | "blocked" | "done" | "failed";
export type OpsTaskPriority = "high" | "medium" | "low";

export type OpsTaskNote = {
  text: string;
  timestamp: string;
};

export type OpsTask = {
  id: string;
  title: string;
  description: string;
  content: string;
  status: OpsTaskStatus;
  priority: OpsTaskPriority;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  notes: OpsTaskNote[];
  source?: string;
};

export type OpsSessionEntry = {
  key: string;
  category: "main" | "subagent" | "hook" | "cron" | "group";
  updatedAt: number;
  ageMs: number;
  ageMinutes: number;
  isActive: boolean;
  model?: string;
  totalTokens?: number;
  contextTokens?: number;
  channel?: string;
  displayName?: string;
  label?: string;
  sessionId?: string;
  task?: string;
  requesterSessionKey?: string;
  subagentStatus?: string;
  hookSource?: string;
};

export type OpsSessionGroup = {
  total: number;
  active: number;
  sessions: OpsSessionEntry[];
};

export type OpsAgentSummary = {
  totalSessions: number;
  activeSessions: number;
  mainAgent?: {
    status: string;
    ageMinutes: number;
    model?: string;
    totalTokens?: number;
    channel?: string;
  };
  subagents: OpsSessionGroup;
  hooks: OpsSessionGroup;
  crons: OpsSessionGroup;
  groups: {
    total: number;
    active: number;
  };
  timestamp: number;
};

export type CreateOpsTaskInput = {
  title: string;
  description?: string;
  priority?: OpsTaskPriority;
  assignee?: string;
};

export type UpdateOpsTaskInput = Partial<
  Pick<
    OpsTask,
    "title" | "description" | "content" | "status" | "priority" | "assignee" | "dueDate" | "source"
  >
>;
