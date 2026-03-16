import { access, readFile } from "node:fs/promises";
import path from "node:path";

async function loadBootstrapFile(filePath, name) {
  try {
    await access(filePath);
    return {
      name,
      path: filePath,
      content: await readFile(filePath, "utf8"),
      missing: false,
    };
  } catch {
    return null;
  }
}

function resolveAgentProfileId(event) {
  const explicitId =
    event?.context?.agentId ||
    event?.agentId ||
    event?.context?.runtimeAgentId ||
    event?.runtimeAgentId;

  if (typeof explicitId === "string" && explicitId.trim()) {
    return explicitId === "main" ? "cd" : explicitId.trim();
  }

  const sessionKey = event?.context?.sessionKey || event?.sessionKey;
  if (typeof sessionKey === "string" && sessionKey.trim()) {
    if (sessionKey === "main") {
      return "cd";
    }
    const match = sessionKey.match(/^agent:([^:]+)/);
    if (match?.[1]) {
      return match[1] === "main" ? "cd" : match[1];
    }
  }

  return null;
}

export default async function handler(event) {
  if (event.type !== "agent" || event.action !== "bootstrap") {
    return;
  }

  const workspaceDir = event.context?.workspaceDir;
  const bootstrapFiles = event.context?.bootstrapFiles;
  if (typeof workspaceDir !== "string" || !Array.isArray(bootstrapFiles)) {
    return;
  }

  const dataDir = process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data";

  const overlayAgents = await loadBootstrapFile(
    path.join(dataDir, "AGENTS.md"),
    "AGENTS.md",
  );
  const overlayTools = await loadBootstrapFile(
    path.join(dataDir, "TOOLS.md"),
    "TOOLS.md",
  );
  const operatingModel = await loadBootstrapFile(
    path.join(dataDir, "AGENT_OPERATING_MODEL.md"),
    "AGENT_OPERATING_MODEL.md",
  );
  const profileId = resolveAgentProfileId(event);
  const profileSoul = profileId
    ? await loadBootstrapFile(
        path.join(dataDir, "agents", "profiles", profileId, "SOUL.md"),
        `SOUL.md (${profileId})`,
      )
    : null;
  const profileMemory = profileId
    ? await loadBootstrapFile(
        path.join(dataDir, "agents", "profiles", profileId, "MEMORY.md"),
        `MEMORY.md (${profileId})`,
      )
    : null;
  const profileHeartbeat = profileId
    ? await loadBootstrapFile(
        path.join(dataDir, "agents", "profiles", profileId, "HEARTBEAT.md"),
        `HEARTBEAT.md (${profileId})`,
      )
    : null;
  const profileDirectives = profileId
    ? await loadBootstrapFile(
        path.join(dataDir, "agents", "profiles", profileId, "DIRECTIVES.md"),
        `DIRECTIVES.md (${profileId})`,
      )
    : null;

  if (overlayAgents) {
    bootstrapFiles.push(overlayAgents);
  }
  if (overlayTools) {
    bootstrapFiles.push(overlayTools);
  }
  if (operatingModel) {
    bootstrapFiles.push(operatingModel);
  }
  if (profileSoul) {
    bootstrapFiles.push(profileSoul);
  }
  if (profileMemory) {
    bootstrapFiles.push(profileMemory);
  }
  if (profileHeartbeat) {
    bootstrapFiles.push(profileHeartbeat);
  }
  if (profileDirectives) {
    bootstrapFiles.push(profileDirectives);
  }
}
