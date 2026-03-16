// ─── Task Document Parser ────────────────────────────────────────
// Ported from dashboard/lib/antigravity-tasks.ts for the Electron shell.
// Zero external dependencies — operates on raw markdown strings.

export interface TaskDocument {
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
}

// ─── Scalar parser ──────────────────────────────────────────────

function parseScalar(raw: string): string | string[] {
  const value = raw.trim();
  if (!value) return '';
  if (value === '[]' || value === '{}') return [];
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

// ─── Frontmatter parser ─────────────────────────────────────────

export function parseFrontmatter(content: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error('Missing frontmatter');
  }

  const data: Record<string, unknown> = {};
  let activeArrayKey: string | null = null;

  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const trimmed = line.trimStart();
    if (trimmed.startsWith('- ') && activeArrayKey) {
      const current = Array.isArray(data[activeArrayKey])
        ? (data[activeArrayKey] as unknown[])
        : [];
      current.push(parseScalar(trimmed.slice(2)));
      data[activeArrayKey] = current;
      continue;
    }

    activeArrayKey = null;
    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyMatch) continue;
    const [, key, rawValue] = keyMatch;
    if (!rawValue.trim()) {
      data[key] = [];
      activeArrayKey = key;
      continue;
    }
    data[key] = parseScalar(rawValue);
  }

  return {
    data,
    body: content.slice(match[0].length).trim(),
  };
}

// ─── Section parser ─────────────────────────────────────────────

export function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) return sections;

  for (let i = 0; i < matches.length; i += 1) {
    const title = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    sections[title] = body.slice(start, end).trim();
  }

  return sections;
}

// ─── Read a single task file ────────────────────────────────────

export function readTaskDocument(
  filePath: string,
  rawContent: string,
): TaskDocument {
  const { data, body } = parseFrontmatter(rawContent);
  const sections = parseSections(body);
  const basename = filePath.replace(/^.*[\\/]/, '').replace(/\.md$/, '');

  return {
    id: String(data.id || basename),
    title: String(data.title || basename),
    status: String(data.status || 'queued'),
    priority: String(data.priority || 'medium'),
    owner_agent: String(data.owner_agent || 'unassigned'),
    agent_type: String(data.agent_type || 'orchestrator'),
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    source: String(data.source || 'manual'),
    depends_on: Array.isArray(data.depends_on) ? data.depends_on.map(String) : [],
    blocked_by: Array.isArray(data.blocked_by) ? data.blocked_by.map(String) : [],
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    artifacts: Array.isArray(data.artifacts) ? data.artifacts.map(String) : [],
    description: sections['Summary'] || '',
    currentState: sections['Current State'] || '',
    acceptance: sections['Acceptance'] || '',
    activityLog: (sections['Activity Log'] || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    notes: sections['Notes'] || '',
    sections,
    rawContent,
  };
}

// ─── Render a TaskDocument back to markdown ─────────────────────

function quote(value: string): string {
  return JSON.stringify(value);
}

function listBlock(name: string, values: string[]): string {
  if (!values.length) return `${name}:\n`;
  return `${name}:\n${values.map((v) => `- ${quote(v)}`).join('\n')}\n`;
}

export function renderTaskDocument(task: TaskDocument): string {
  return (
    `---\n` +
    `id: ${quote(task.id)}\n` +
    `title: ${quote(task.title)}\n` +
    `status: ${quote(task.status)}\n` +
    `priority: ${quote(task.priority)}\n` +
    `owner_agent: ${quote(task.owner_agent)}\n` +
    `agent_type: ${quote(task.agent_type)}\n` +
    `created_at: ${quote(task.created_at)}\n` +
    `updated_at: ${quote(task.updated_at)}\n` +
    `source: ${quote(task.source)}\n` +
    listBlock('depends_on', task.depends_on) +
    listBlock('blocked_by', task.blocked_by) +
    listBlock('tags', task.tags) +
    listBlock('artifacts', task.artifacts) +
    `---\n\n` +
    `## Summary\n\n${task.description.trim() || task.title}\n\n` +
    `## Current State\n\n${task.currentState.trim() || '- State: queued\n- Next action: review and refine this task.'}\n\n` +
    `## Acceptance\n\n${task.acceptance.trim() || `- [ ] Define acceptance for ${task.id}`}\n\n` +
    `## Activity Log\n\n${task.activityLog.join('\n') || `- ${task.updated_at} ${task.owner_agent}: Task file created.`}\n\n` +
    `## Notes\n\n${task.notes.trim() || 'None.'}\n`
  );
}
