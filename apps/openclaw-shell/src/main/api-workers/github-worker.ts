import { EventEmitter } from 'events';
import { join } from 'path';
import { homedir } from 'os';
import { readFileSync, existsSync } from 'fs';
import { SHELL_CONFIG_DIR_NAME } from '../../shared/constants.js';
import type { APIWorker } from './worker-manager.js';
import type { CredentialProvider } from './credential-provider.js';
import type { APIWorkerStatus, GitHubNotification, GitHubPR, GitHubIssue } from '../../shared/types.js';
import { getMainPool } from '../db-pool.js';
import { upsertGitHubNotifications, markNotificationReadInDb } from './db/github-repo.js';

const CREDENTIALS_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, 'api-credentials.json');
const POLL_INTERVAL_MS = 60_000;
const RATE_LIMIT_PAUSE_THRESHOLD = 50;

interface GitHubCredentials {
  personal_access_token: string;
}

interface CredentialsFile {
  github?: GitHubCredentials;
  [key: string]: unknown;
}

function loadPAT(): string | null {
  if (!existsSync(CREDENTIALS_FILE)) {
    console.warn('[GitHubWorker] Credentials file not found, GitHub API unavailable.');
    return null;
  }
  try {
    const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
    const creds = JSON.parse(raw) as CredentialsFile;
    if (!creds.github?.personal_access_token) {
      console.warn('[GitHubWorker] No GitHub PAT found in credentials file.');
      return null;
    }
    return creds.github.personal_access_token;
  } catch (err) {
    console.warn('[GitHubWorker] Failed to read credentials file:', err);
    return null;
  }
}

async function githubFetch(
  pat: string,
  path: string,
  options: RequestInit = {},
): Promise<{ data: unknown; rateLimitRemaining: number }> {
  const url = `https://api.github.com${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const rateLimitRemaining = parseInt(
    response.headers.get('X-RateLimit-Remaining') ?? '999',
    10,
  );

  if (response.status === 401) {
    throw new Error('GitHub authentication failed. Check your PAT.');
  }

  if (response.status === 403) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(`GitHub forbidden: ${body.message ?? response.statusText}`);
  }

  if (response.status === 204) {
    return { data: null, rateLimitRemaining };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(`GitHub API error ${response.status}: ${body.message ?? response.statusText}`);
  }

  const data = await response.json();
  return { data, rateLimitRemaining };
}

export class GitHubWorker extends EventEmitter implements APIWorker {
  readonly name = 'github';
  readonly pollIntervalMs = POLL_INTERVAL_MS;

  private pat: string | null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private errorCount = 0;
  private consecutiveErrors = 0;
  private lastPollAt: string | null = null;
  private rateLimitPausedUntil = 0;
  private backoffMs = 0;
  private credentialProvider: CredentialProvider | null = null;

  static withCredentialProvider(provider: CredentialProvider): GitHubWorker {
    const worker = new GitHubWorker();
    worker.credentialProvider = provider;
    return worker;
  }

  constructor() {
    super();
    this.pat = loadPAT();
  }

  start(): void {
    if (this.isRunning) return;

    // Try vault first if credential provider is available
    if (this.credentialProvider && !this.pat) {
      void this.credentialProvider
        .getCredential('openclaw/api-keys/github-pat', 'build')
        .then((pat) => {
          this.pat = pat;
          this.beginPolling();
        })
        .catch((err) => {
          console.warn('[GitHubWorker] Vault unavailable, falling back to file:', err);
          if (!this.pat) this.pat = loadPAT();
          this.beginPolling();
        });
      return;
    }

    if (!this.pat) {
      console.warn('[GitHubWorker] No PAT available — worker will not poll.');
      return;
    }
    this.beginPolling();
  }

  private beginPolling(): void {
    if (!this.pat || this.isRunning) return;
    this.isRunning = true;
    void this.poll();
    this.intervalHandle = setInterval(() => void this.poll(), this.pollIntervalMs);
    console.log('[GitHubWorker] Started.');
  }

  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    console.log('[GitHubWorker] Stopped.');
  }

  getStatus(): APIWorkerStatus {
    return {
      name: this.name,
      isRunning: this.isRunning,
      lastPollAt: this.lastPollAt,
      errorCount: this.errorCount,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  async refreshCredentials(): Promise<void> {
    if (this.credentialProvider) {
      try {
        this.pat = await this.credentialProvider.getCredential('openclaw/api-keys/github-pat', 'build');
        console.log('[GitHubWorker] Credentials refreshed from vault.');
      } catch (err) {
        console.warn('[GitHubWorker] Failed to refresh from vault, keeping current PAT:', err);
      }
    } else {
      this.pat = loadPAT();
    }
  }

  private async poll(): Promise<void> {
    if (!this.pat) return;

    const now = Date.now();
    if (now < this.rateLimitPausedUntil) {
      console.warn('[GitHubWorker] Rate limit pause active, skipping poll.');
      return;
    }
    if (this.backoffMs > 0 && now < (this.lastPollAt ? new Date(this.lastPollAt).getTime() + this.backoffMs : 0)) {
      return;
    }

    try {
      const { data, rateLimitRemaining } = await githubFetch(this.pat, '/notifications?all=false');

      if (rateLimitRemaining < RATE_LIMIT_PAUSE_THRESHOLD) {
        this.rateLimitPausedUntil = now + 60_000;
        console.warn(`[GitHubWorker] Rate limit low (${rateLimitRemaining}), pausing 60s.`);
      }

      this.lastPollAt = new Date().toISOString();
      this.consecutiveErrors = 0;
      this.backoffMs = 0;

      const notifications = (data as RawNotification[]).map(mapNotification);
      if (notifications.length > 0) {
        this.emit('notifications', notifications);

        // Persist poll results to Postgres (best-effort — don't fail the poll on DB error)
        try {
          await upsertGitHubNotifications(getMainPool(), notifications);
        } catch (dbErr) {
          console.warn('[GitHubWorker] DB persist failed (non-fatal):', dbErr);
        }
      }
    } catch (err) {
      this.errorCount++;
      this.consecutiveErrors++;
      this.backoffMs = Math.min(30_000 * Math.pow(2, this.consecutiveErrors - 1), 600_000);
      console.error('[GitHubWorker] Poll error:', err);
      this.emit('error', err);
    }
  }

  // ── Public API Methods ──────────────────────────────────────────

  async listNotifications(all = false): Promise<GitHubNotification[]> {
    this.requirePAT();
    const { data } = await githubFetch(this.pat!, `/notifications?all=${all}`);
    return (data as RawNotification[]).map(mapNotification);
  }

  async markNotificationRead(threadId: string): Promise<void> {
    this.requirePAT();
    await githubFetch(this.pat!, `/notifications/threads/${threadId}`, { method: 'PATCH' });
    // Mirror read state to local DB cache (best-effort)
    try {
      await markNotificationReadInDb(getMainPool(), threadId);
    } catch (dbErr) {
      console.warn('[GitHubWorker] DB mark-read failed (non-fatal):', dbErr);
    }
  }

  async listPRs(owner: string, repo: string, state = 'open'): Promise<GitHubPR[]> {
    this.requirePAT();
    const { data } = await githubFetch(this.pat!, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`);
    return (data as RawPR[]).map(mapPR);
  }

  async getPR(owner: string, repo: string, number: number): Promise<GitHubPR> {
    this.requirePAT();
    const { data } = await githubFetch(this.pat!, `/repos/${owner}/${repo}/pulls/${number}`);
    return mapPR(data as RawPR);
  }

  async reviewPR(
    owner: string,
    repo: string,
    number: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ): Promise<void> {
    this.requirePAT();
    await githubFetch(this.pat!, `/repos/${owner}/${repo}/pulls/${number}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ body, event }),
    });
  }

  async mergePR(
    owner: string,
    repo: string,
    number: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge',
  ): Promise<void> {
    this.requirePAT();
    await githubFetch(this.pat!, `/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: mergeMethod }),
    });
  }

  async listIssues(owner: string, repo: string, state = 'open'): Promise<GitHubIssue[]> {
    this.requirePAT();
    const { data } = await githubFetch(
      this.pat!,
      `/repos/${owner}/${repo}/issues?state=${state}&per_page=100`,
    );
    return (data as RawIssue[]).filter((i) => !i.pull_request).map(mapIssue);
  }

  async commentOnIssue(owner: string, repo: string, number: number, body: string): Promise<void> {
    this.requirePAT();
    await githubFetch(this.pat!, `/repos/${owner}/${repo}/issues/${number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  private requirePAT(): void {
    if (!this.pat) {
      throw new Error('GitHub PAT not configured. Add github.personal_access_token to api-credentials.json.');
    }
  }
}

// ── Raw response shapes (minimal) ────────────────────────────────

interface RawNotification {
  id: string;
  reason: string;
  subject: { title: string; url: string; type: string };
  repository: { full_name: string };
  updated_at: string;
  unread: boolean;
}

interface RawPR {
  number: number;
  title: string;
  state: string;
  user: { login: string };
  base: { ref: string };
  head: { ref: string };
  mergeable: boolean | null;
  auto_merge: null | object;
  html_url: string;
}

interface RawIssue {
  number: number;
  title: string;
  state: string;
  user: { login: string };
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  html_url: string;
  pull_request?: object;
}

function mapNotification(n: RawNotification): GitHubNotification {
  return {
    id: n.id,
    reason: n.reason,
    subject: n.subject,
    repository: n.repository,
    updated_at: n.updated_at,
    unread: n.unread,
  };
}

function mapPR(pr: RawPR): GitHubPR {
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    user: pr.user.login,
    base: pr.base.ref,
    head: pr.head.ref,
    mergeable: pr.mergeable,
    url: pr.html_url,
  };
}

function mapIssue(issue: RawIssue): GitHubIssue {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    user: issue.user.login,
    labels: issue.labels.map((l) => l.name),
    assignees: issue.assignees.map((a) => a.login),
    url: issue.html_url,
  };
}
