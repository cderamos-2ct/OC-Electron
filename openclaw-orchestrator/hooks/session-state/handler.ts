import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function readRunState(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {
      version: 1,
      active: false,
      currentPhase: "idle",
      lastEvent: "init",
      lastEventAt: new Date().toISOString(),
      stopReason: "",
      history: [],
    };
  }
}

export default async function handler(event) {
  if (event.type !== "command") {
    return;
  }

  const workspaceDir = event.context?.workspaceDir;
  if (typeof workspaceDir !== "string" || !workspaceDir.trim()) {
    return;
  }

  const overlayDir = path.join(workspaceDir, ".antigravity");
  const runStatePath = path.join(overlayDir, "run-state.json");
  await mkdir(overlayDir, { recursive: true });

  const runState = await readRunState(runStatePath);
  runState.lastEvent = event.action;
  runState.lastEventAt = new Date().toISOString();
  runState.sessionKey = event.sessionKey;
  runState.active = event.action !== "stop";
  runState.currentPhase = event.action === "stop" ? "stopped" : "session-reset";
  if (event.action === "stop") {
    runState.stopReason = "manual-stop";
  }
  runState.history = Array.isArray(runState.history) ? runState.history : [];
  runState.history.push({
    action: event.action,
    at: runState.lastEventAt,
    sessionKey: event.sessionKey,
  });
  runState.history = runState.history.slice(-25);

  await writeFile(runStatePath, JSON.stringify(runState, null, 2) + "\n", "utf8");
}
