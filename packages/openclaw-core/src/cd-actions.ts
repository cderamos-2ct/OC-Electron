// ─── CD Action Types (Computer-Directed Actions) ───────────────────────────

export type CDActionType = 'click' | 'fill' | 'select' | 'navigate' | 'read' | 'scroll' | 'screenshot' | 'wait';

export type CDActionRiskTier = 'silent' | 'confirm' | 'confirm-send';

export type CDAction = {
  id: string;
  type: CDActionType;
  agentId: string;
  serviceId: string;
  description: string;
  riskTier: CDActionRiskTier;
  target: {
    selector?: string;
    url?: string;
    value?: string;
    text?: string;
  };
  context?: string;
  requestedAt: string;
};

export type ApprovalDecision = 'approved' | 'denied' | 'auto-approved';

export type ApprovalResult = {
  actionId: string;
  decision: ApprovalDecision;
  decidedAt: string;
  autoApproveRuleId?: string;
};

export type AutoApproveRule = {
  id: string;
  agentId: string;
  serviceId: string;
  actionType: CDActionType;
  createdAt: string;
};

export type CDActionResult = {
  actionId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
};

export type PendingApproval = {
  action: CDAction;
  status: 'pending' | 'approved' | 'denied';
};

export type AuditLogEntry = {
  timestamp: string;
  actionId: string;
  agentId: string;
  serviceId: string;
  actionType: CDActionType;
  target: CDAction['target'];
  description: string;
  riskTier: CDActionRiskTier;
  decision: ApprovalDecision;
  autoApproveRuleId?: string;
  result?: {
    success: boolean;
    error?: string;
    durationMs: number;
  };
};

// ─── Observation Types ──────────────────────────────────────────────────────

export type PageContext = {
  url: string;
  title: string;
  selectedText: string;
  visibleText: string;
  structuredContent: unknown | null;
};

export type ObserveConfig = {
  observeSelector?: string;
  includeScreenshot?: boolean;
};

export type MutationSummary = {
  addedNodes: number;
  removedNodes: number;
  textChanges: number;
  timestamp: string;
};
