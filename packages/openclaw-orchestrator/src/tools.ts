import {
  buildConsensusResult,
  ensureConsensus,
  findTask,
  loadOverlay,
  resolveRepoRoot,
  saveRunState,
  saveTasks,
  summarizeTasks,
} from "./overlay.js";

function textResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function schema(properties, required = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

async function orchestratorStatus(api, params) {
  const repoRoot = resolveRepoRoot(params.repoRoot, api);
  const overlay = await loadOverlay(repoRoot);
  return textResult({
    repoRoot,
    overlayDir: overlay.overlayDir,
    taskSummary: summarizeTasks(overlay.tasksFile),
    currentPhase: overlay.runState.currentPhase,
    active: overlay.runState.active,
    lastEvent: overlay.runState.lastEvent,
    lastEventAt: overlay.runState.lastEventAt,
  });
}

async function taskList(api, params) {
  const repoRoot = resolveRepoRoot(params.repoRoot, api);
  const overlay = await loadOverlay(repoRoot);
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const roleFilter = typeof params.ownerRole === "string" ? params.ownerRole : "";
  const tasks = overlay.tasksFile.tasks.filter((task) => {
    if (statusFilter && task.status !== statusFilter) return false;
    if (roleFilter && task.ownerRole !== roleFilter) return false;
    return true;
  });
  return textResult({
    repoRoot,
    count: tasks.length,
    tasks,
  });
}

async function taskClaim(api, params) {
  const repoRoot = resolveRepoRoot(params.repoRoot, api);
  const overlay = await loadOverlay(repoRoot);
  const task = findTask(overlay.tasksFile, params.taskId);
  if (!task) {
    return textResult({ ok: false, error: `Task not found: ${params.taskId}` });
  }

  const blockedBy = Array.isArray(task.blockedBy) ? task.blockedBy : [];
  const unresolved = blockedBy.filter((taskId) => {
    const dep = findTask(overlay.tasksFile, taskId);
    return dep && dep.status !== "completed";
  });
  if (unresolved.length > 0) {
    task.status = "blocked";
    task.updatedAt = new Date().toISOString();
    task.notes = [...(task.notes || []), `Claim blocked by: ${unresolved.join(", ")}`];
    await saveTasks(overlay.tasksPath, overlay.tasksFile);
    return textResult({ ok: false, taskId: task.id, blockedBy: unresolved });
  }

  task.status = "in_progress";
  task.ownerRole = params.ownerRole;
  task.ownerSession = params.ownerSession || "openclaw";
  task.claimedAt = new Date().toISOString();
  task.updatedAt = task.claimedAt;
  if (params.note) {
    task.notes = [...(task.notes || []), params.note];
  }
  overlay.runState.active = true;
  overlay.runState.currentPhase = "task-exec";
  overlay.runState.currentTaskId = task.id;
  overlay.runState.lastEvent = "task_claim";
  await saveTasks(overlay.tasksPath, overlay.tasksFile);
  await saveRunState(overlay.runStatePath, overlay.runState);
  return textResult({ ok: true, task });
}

async function taskUpdate(api, params) {
  const repoRoot = resolveRepoRoot(params.repoRoot, api);
  const overlay = await loadOverlay(repoRoot);
  const task = findTask(overlay.tasksFile, params.taskId);
  if (!task) {
    return textResult({ ok: false, error: `Task not found: ${params.taskId}` });
  }

  if (params.status) {
    task.status = params.status;
  }
  if (params.summary) {
    task.summary = params.summary;
  }
  if (params.result) {
    task.result = params.result;
  }
  if (params.note) {
    task.notes = [...(task.notes || []), params.note];
  }
  if (Array.isArray(params.flags)) {
    task.flags = params.flags;
  }

  const consensus = ensureConsensus(task);
  if (params.voteRole && params.voteStatus) {
    consensus.votes[params.voteRole] = {
      status: params.voteStatus,
      summary: params.voteSummary || "",
      updatedAt: new Date().toISOString(),
    };
  }
  if (params.ciStatus) {
    consensus.ciStatus = params.ciStatus;
  }

  task.updatedAt = new Date().toISOString();
  overlay.runState.lastEvent = "task_update";
  overlay.runState.currentTaskId = task.id;
  overlay.runState.currentPhase = task.status === "completed" ? "task-complete" : "task-exec";
  overlay.runState.active = task.status !== "completed" && task.status !== "blocked";
  await saveTasks(overlay.tasksPath, overlay.tasksFile);
  await saveRunState(overlay.runStatePath, overlay.runState);
  return textResult({ ok: true, task });
}

async function roleRoute(api, params) {
  const repoRoot = resolveRepoRoot(params.repoRoot, api);
  const overlay = await loadOverlay(repoRoot);
  const route = overlay.policyFile.roles?.[params.role];
  if (!route) {
    return textResult({ ok: false, error: `No route configured for role: ${params.role}` });
  }
  return textResult({ ok: true, role: params.role, route });
}

async function consensusCheck(api, params) {
  const repoRoot = resolveRepoRoot(params.repoRoot, api);
  const overlay = await loadOverlay(repoRoot);
  const task = findTask(overlay.tasksFile, params.taskId);
  if (!task) {
    return textResult({ ok: false, error: `Task not found: ${params.taskId}` });
  }
  return textResult(buildConsensusResult(task, overlay.policyFile, params.ciStatus));
}

export function registerOrchestratorTools(api) {
  const definitions = [
    {
      name: "orchestrator_status",
      description: "Summarize repo-local orchestration state from .antigravity",
      parameters: schema({
        repoRoot: { type: "string" },
      }),
      execute: (_id, params) => orchestratorStatus(api, params || {}),
    },
    {
      name: "task_list",
      description: "List tasks from .antigravity/tasks/tasks.json",
      parameters: schema({
        repoRoot: { type: "string" },
        status: { type: "string" },
        ownerRole: { type: "string" },
      }),
      execute: (_id, params) => taskList(api, params || {}),
    },
    {
      name: "task_claim",
      description: "Claim a task for a role and worker session",
      parameters: schema(
        {
          repoRoot: { type: "string" },
          taskId: { type: "string" },
          ownerRole: { type: "string" },
          ownerSession: { type: "string" },
          note: { type: "string" },
        },
        ["taskId", "ownerRole"],
      ),
      execute: (_id, params) => taskClaim(api, params || {}),
    },
    {
      name: "task_update",
      description: "Update task state, notes, and consensus vote data",
      parameters: schema(
        {
          repoRoot: { type: "string" },
          taskId: { type: "string" },
          status: { type: "string" },
          summary: { type: "string" },
          result: { type: "string" },
          note: { type: "string" },
          voteRole: { type: "string" },
          voteStatus: { type: "string" },
          voteSummary: { type: "string" },
          ciStatus: { type: "string" },
          flags: {
            type: "array",
            items: { type: "string" },
          },
        },
        ["taskId"],
      ),
      execute: (_id, params) => taskUpdate(api, params || {}),
    },
    {
      name: "role_route",
      description: "Resolve the preferred provider/model routing for a role",
      parameters: schema(
        {
          repoRoot: { type: "string" },
          role: { type: "string" },
        },
        ["role"],
      ),
      execute: (_id, params) => roleRoute(api, params || {}),
    },
    {
      name: "consensus_check",
      description: "Evaluate required votes and CI status against policy",
      parameters: schema(
        {
          repoRoot: { type: "string" },
          taskId: { type: "string" },
          ciStatus: { type: "string" },
        },
        ["taskId"],
      ),
      execute: (_id, params) => consensusCheck(api, params || {}),
    },
  ];

  for (const tool of definitions) {
    api.registerTool(tool, { optional: true });
  }
}
