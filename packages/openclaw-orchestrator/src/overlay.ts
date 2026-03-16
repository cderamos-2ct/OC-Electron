import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OVERLAY_DIR = process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data";
const TASKS_REL = path.join("tasks", "tasks.json");
const POLICY_REL = path.join("rules", "model-routing-policy.json");
const RUN_STATE_REL = "run-state.json";
const QUALITY_REL = "task-quality-gates.jsonl";

function nowIso() {
  return new Date().toISOString();
}

function defaultTasks() {
  return {
    version: 1,
    updatedAt: nowIso(),
    tasks: [],
  };
}

function defaultPolicy() {
  return {
    version: 1,
    updatedAt: nowIso(),
    roles: {
      executor: {
        primary: {
          provider: "openai-codex",
          model: "gpt-5.4",
          purpose: "Primary implementation lane",
        },
      },
      architect: {
        primary: {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          purpose: "Architecture and integration risk",
        },
      },
      verifier: {
        primary: {
          provider: "google-gemini-cli",
          model: "gemini-3-pro-preview",
          purpose: "Large-context verification",
        },
        contextWindowHint: "1M",
      },
    },
    consensus: {
      arbiter: "orchestrator-policy-engine",
      requiredVotes: ["executor", "architect", "verifier"],
      passCriteria: {
        executorStatus: "pass",
        architectStatus: "pass",
        verifierStatus: "pass",
        ciStatus: "pass",
      },
      blockOn: ["security_high_or_critical", "lint_stack_fail", "missing_required_vote", "ci_fail"],
    },
  };
}

function defaultRunState() {
  return {
    version: 1,
    active: false,
    currentPhase: "idle",
    lastEvent: "init",
    lastEventAt: nowIso(),
    stopReason: "",
  };
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function resolveRepoRoot(explicitRepoRoot, api) {
  if (typeof explicitRepoRoot === "string" && explicitRepoRoot.trim()) {
    return path.resolve(explicitRepoRoot);
  }
  const configured = api?.config?.agents?.defaults?.workspace;
  if (typeof configured === "string" && configured.trim()) {
    return path.resolve(configured);
  }
  return process.cwd();
}

export async function ensureOverlay(repoRoot) {
  const overlayDir = path.join(repoRoot, OVERLAY_DIR);
  const tasksDir = path.join(overlayDir, "tasks");
  const rulesDir = path.join(overlayDir, "rules");
  await mkdir(tasksDir, { recursive: true });
  await mkdir(rulesDir, { recursive: true });

  const tasksPath = path.join(overlayDir, TASKS_REL);
  const policyPath = path.join(overlayDir, POLICY_REL);
  const runStatePath = path.join(overlayDir, RUN_STATE_REL);
  const qualityPath = path.join(overlayDir, QUALITY_REL);

  const tasks = await readJson(tasksPath, null);
  if (!tasks) {
    await writeJson(tasksPath, defaultTasks());
  }

  const policy = await readJson(policyPath, null);
  if (!policy) {
    await writeJson(policyPath, defaultPolicy());
  }

  const runState = await readJson(runStatePath, null);
  if (!runState) {
    await writeJson(runStatePath, defaultRunState());
  }

  try {
    await readFile(qualityPath, "utf8");
  } catch {
    await writeFile(qualityPath, "", "utf8");
  }

  return {
    repoRoot,
    overlayDir,
    tasksPath,
    policyPath,
    runStatePath,
    qualityPath,
  };
}

export async function loadOverlay(repoRoot) {
  const paths = await ensureOverlay(repoRoot);
  const tasksFile = await readJson(paths.tasksPath, defaultTasks());
  const policyFile = await readJson(paths.policyPath, defaultPolicy());
  const runState = await readJson(paths.runStatePath, defaultRunState());
  return {
    ...paths,
    tasksFile,
    policyFile,
    runState,
  };
}

export async function saveTasks(tasksPath, tasksFile) {
  tasksFile.updatedAt = nowIso();
  await writeJson(tasksPath, tasksFile);
}

export async function saveRunState(runStatePath, runState) {
  runState.lastEventAt = nowIso();
  await writeJson(runStatePath, runState);
}

export function findTask(tasksFile, taskId) {
  return tasksFile.tasks.find((task) => task.id === taskId);
}

export function summarizeTasks(tasksFile) {
  const summary = {
    total: tasksFile.tasks.length,
    pending: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
  };
  for (const task of tasksFile.tasks) {
    if (task.status && summary[task.status] !== undefined) {
      summary[task.status] += 1;
    }
  }
  return summary;
}

export function ensureConsensus(task) {
  if (!task.consensus) {
    task.consensus = { votes: {}, ciStatus: "unknown" };
  }
  if (!task.consensus.votes) {
    task.consensus.votes = {};
  }
  if (!task.consensus.ciStatus) {
    task.consensus.ciStatus = "unknown";
  }
  return task.consensus;
}

export function buildConsensusResult(task, policyFile, ciStatusOverride) {
  const consensus = ensureConsensus(task);
  const requiredVotes = policyFile?.consensus?.requiredVotes || [];
  const votes = consensus.votes || {};
  const missingVotes = requiredVotes.filter((role) => !votes[role]);
  const failingVotes = requiredVotes.filter((role) => votes[role] && votes[role].status !== "pass");
  const ciStatus = ciStatusOverride || consensus.ciStatus || "unknown";
  const blockedReasons = [];

  if (missingVotes.length > 0) {
    blockedReasons.push("missing_required_vote");
  }
  if (ciStatus !== "pass") {
    blockedReasons.push("ci_fail");
  }
  if (Array.isArray(task.flags)) {
    for (const flag of task.flags) {
      if (policyFile?.consensus?.blockOn?.includes(flag) && !blockedReasons.includes(flag)) {
        blockedReasons.push(flag);
      }
    }
  }

  return {
    taskId: task.id,
    passed: missingVotes.length === 0 && failingVotes.length === 0 && ciStatus === "pass" && blockedReasons.length === 0,
    missingVotes,
    failingVotes: failingVotes.map((role) => ({ role, status: votes[role]?.status || "missing" })),
    ciStatus,
    blockedReasons,
    votes,
  };
}
