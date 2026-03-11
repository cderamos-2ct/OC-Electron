import type { BuilderConfig, BuilderWidgetDefinition } from "@/lib/builder-types";
import { cloneBuilderConfig, normalizeBuilderConfig } from "@/lib/builder-types";

export const DASHBOARD_SCREEN_KEYS = [
  "overview",
  "ops",
  "chat",
  "heartbeat",
  "agents",
  "models",
  "voice",
  "nodes",
  "skills",
  "channels",
  "cron",
  "config",
  "logs",
] as const;

export type DashboardScreenKey = (typeof DASHBOARD_SCREEN_KEYS)[number];

export type DashboardScreenLayoutDefinition = {
  key: DashboardScreenKey;
  path: string;
  label: string;
  description: string;
  canvas: {
    width: number;
    height: number;
  };
  widgets: BuilderWidgetDefinition[];
  defaultConfig: BuilderConfig;
};

type LayoutWidgetSeed = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
};

function buildWidgetDefinition(
  type: string,
  name: string,
  description: string,
  defaultWidth: number,
  defaultHeight: number,
) {
  return {
    type,
    name,
    category: "Dashboard",
    description,
    defaultWidth,
    defaultHeight,
    properties: {
      title: name,
    },
  } satisfies BuilderWidgetDefinition;
}

function buildDefaultConfig(
  canvas: { width: number; height: number },
  widgets: LayoutWidgetSeed[],
) {
  return normalizeBuilderConfig({
    canvas,
    widgets: widgets.map((widget) => ({
      ...widget,
      properties: {
        title: widget.title,
      },
    })),
  });
}

function createScreenDefinition(
  key: DashboardScreenKey,
  path: string,
  label: string,
  description: string,
  canvas: { width: number; height: number },
  widgets: Array<
    LayoutWidgetSeed & {
      name: string;
      widgetDescription: string;
    }
  >,
): DashboardScreenLayoutDefinition {
  return {
    key,
    path,
    label,
    description,
    canvas,
    widgets: widgets.map((widget) =>
      buildWidgetDefinition(
        widget.type,
        widget.name,
        widget.widgetDescription,
        widget.width,
        widget.height,
      ),
    ),
    defaultConfig: buildDefaultConfig(canvas, widgets),
  };
}

const SCREEN_DEFINITIONS = [
  createScreenDefinition(
    "overview",
    "/",
    "Overview",
    "Gateway health, resources, and connected surfaces.",
    { width: 1440, height: 900 },
    [
      {
        id: "overview-status",
        type: "overview.status",
        name: "Status grid",
        widgetDescription: "Gateway health, uptime, version, and connected clients.",
        x: 24,
        y: 24,
        width: 684,
        height: 220,
        title: "Status grid",
      },
      {
        id: "overview-resources",
        type: "overview.resources",
        name: "Resource grid",
        widgetDescription: "Agent, model, channel, and skill entry points.",
        x: 732,
        y: 24,
        width: 684,
        height: 220,
        title: "Resource grid",
      },
      {
        id: "overview-clients",
        type: "overview.clients",
        name: "Connected clients",
        widgetDescription: "Presence list for connected devices and control surfaces.",
        x: 24,
        y: 268,
        width: 876,
        height: 300,
        title: "Connected clients",
      },
      {
        id: "overview-channels",
        type: "overview.channels",
        name: "Channel status",
        widgetDescription: "Linked state and contact details for active channels.",
        x: 924,
        y: 268,
        width: 492,
        height: 300,
        title: "Channel status",
      },
    ],
  ),
  createScreenDefinition(
    "ops",
    "/ops",
    "Ops",
    "Task orchestration, task detail, and live multi-agent sessions.",
    { width: 1680, height: 1240 },
    [
      {
        id: "ops-summary",
        type: "ops.summary",
        name: "Ops summary",
        widgetDescription: "Active sessions and operational status summary cards.",
        x: 24,
        y: 24,
        width: 804,
        height: 230,
        title: "Ops summary",
      },
      {
        id: "ops-create",
        type: "ops.create",
        name: "Task composer",
        widgetDescription: "Create new operational tasks.",
        x: 852,
        y: 24,
        width: 804,
        height: 230,
        title: "Task composer",
      },
      {
        id: "ops-board",
        type: "ops.board",
        name: "Task board",
        widgetDescription: "Kanban board for queued, running, done, and failed tasks.",
        x: 24,
        y: 278,
        width: 1032,
        height: 930,
        title: "Task board",
      },
      {
        id: "ops-detail",
        type: "ops.detail",
        name: "Task detail",
        widgetDescription: "Task metadata, controls, and execution notes.",
        x: 1080,
        y: 278,
        width: 576,
        height: 560,
        title: "Task detail",
      },
      {
        id: "ops-sessions",
        type: "ops.sessions",
        name: "Live sessions",
        widgetDescription: "Subagent, hook, and cron session monitor.",
        x: 1080,
        y: 862,
        width: 576,
        height: 346,
        title: "Live sessions",
      },
    ],
  ),
  createScreenDefinition(
    "chat",
    "/chat",
    "Chat",
    "Conversation workspace with integrated session switching.",
    { width: 1600, height: 1000 },
    [
      {
        id: "chat-sessions",
        type: "chat.sessions",
        name: "Session rail",
        widgetDescription: "Browse, filter, and manage chat sessions.",
        x: 24,
        y: 24,
        width: 360,
        height: 952,
        title: "Session rail",
      },
      {
        id: "chat-thread",
        type: "chat.thread",
        name: "Conversation thread",
        widgetDescription: "Messages, streaming responses, and chat composer.",
        x: 408,
        y: 24,
        width: 1168,
        height: 952,
        title: "Conversation thread",
      },
    ],
  ),
  createScreenDefinition(
    "heartbeat",
    "/heartbeat",
    "Heartbeat",
    "Agent heartbeat monitoring, review, and proactive activity.",
    { width: 1520, height: 980 },
    [
      {
        id: "heartbeat-board",
        type: "heartbeat.board",
        name: "Heartbeat board",
        widgetDescription: "Agent heartbeat surface with per-agent activity and policy pointers.",
        x: 24,
        y: 24,
        width: 1472,
        height: 932,
        title: "Heartbeat board",
      },
    ],
  ),
  createScreenDefinition(
    "agents",
    "/agents",
    "Agents",
    "Agent inventory and management grid.",
    { width: 1400, height: 960 },
    [
      {
        id: "agents-grid",
        type: "agents.grid",
        name: "Agent grid",
        widgetDescription: "Browse, create, and manage configured agents.",
        x: 24,
        y: 24,
        width: 1352,
        height: 912,
        title: "Agent grid",
      },
    ],
  ),
  createScreenDefinition(
    "models",
    "/models",
    "Models",
    "Provider inventory and model availability.",
    { width: 1400, height: 960 },
    [
      {
        id: "models-providers",
        type: "models.providers",
        name: "Model catalog",
        widgetDescription: "Provider-grouped model inventory and filters.",
        x: 24,
        y: 24,
        width: 1352,
        height: 912,
        title: "Model catalog",
      },
    ],
  ),
  createScreenDefinition(
    "voice",
    "/voice",
    "Voice & STT",
    "Voice controls, speech-to-text, and talk mode.",
    { width: 1400, height: 980 },
    [
      {
        id: "voice-workspace",
        type: "voice.workspace",
        name: "Voice workspace",
        widgetDescription: "Text-to-speech, speech-to-text, and talk mode controls.",
        x: 24,
        y: 24,
        width: 1352,
        height: 932,
        title: "Voice workspace",
      },
    ],
  ),
  createScreenDefinition(
    "nodes",
    "/nodes",
    "Nodes",
    "Node inventory and paired devices.",
    { width: 1400, height: 980 },
    [
      {
        id: "nodes-grid",
        type: "nodes.grid",
        name: "Nodes",
        widgetDescription: "Connected node inventory.",
        x: 24,
        y: 24,
        width: 876,
        height: 932,
        title: "Nodes",
      },
      {
        id: "nodes-devices",
        type: "nodes.devices",
        name: "Devices",
        widgetDescription: "Paired device approvals and removal controls.",
        x: 924,
        y: 24,
        width: 452,
        height: 932,
        title: "Devices",
      },
    ],
  ),
  createScreenDefinition(
    "skills",
    "/skills",
    "Skills",
    "Skill availability, filters, and install state.",
    { width: 1400, height: 980 },
    [
      {
        id: "skills-controls",
        type: "skills.controls",
        name: "Skill controls",
        widgetDescription: "Search and filter controls for skills.",
        x: 24,
        y: 24,
        width: 1352,
        height: 120,
        title: "Skill controls",
      },
      {
        id: "skills-grid",
        type: "skills.grid",
        name: "Skill grid",
        widgetDescription: "Skill cards with readiness status.",
        x: 24,
        y: 168,
        width: 1352,
        height: 788,
        title: "Skill grid",
      },
    ],
  ),
  createScreenDefinition(
    "channels",
    "/channels",
    "Channels",
    "Channel linkage, QR login, and status management.",
    { width: 1400, height: 980 },
    [
      {
        id: "channels-workspace",
        type: "channels.workspace",
        name: "Channel workspace",
        widgetDescription: "Channel status cards and login flows.",
        x: 24,
        y: 24,
        width: 1352,
        height: 932,
        title: "Channel workspace",
      },
    ],
  ),
  createScreenDefinition(
    "cron",
    "/cron",
    "Cron",
    "Scheduled jobs and recurring commands.",
    { width: 1400, height: 960 },
    [
      {
        id: "cron-jobs",
        type: "cron.jobs",
        name: "Cron jobs",
        widgetDescription: "Job status, enablement, and run controls.",
        x: 24,
        y: 24,
        width: 1352,
        height: 912,
        title: "Cron jobs",
      },
    ],
  ),
  createScreenDefinition(
    "config",
    "/config",
    "Config",
    "Configuration search and editable sections.",
    { width: 1400, height: 980 },
    [
      {
        id: "config-search",
        type: "config.search",
        name: "Config search",
        widgetDescription: "Search and file path context for configuration.",
        x: 24,
        y: 24,
        width: 1352,
        height: 120,
        title: "Config search",
      },
      {
        id: "config-sections",
        type: "config.sections",
        name: "Config sections",
        widgetDescription: "Configuration section list and inline editing.",
        x: 24,
        y: 168,
        width: 1352,
        height: 788,
        title: "Config sections",
      },
    ],
  ),
  createScreenDefinition(
    "logs",
    "/logs",
    "Logs",
    "Live log console and filters.",
    { width: 1400, height: 980 },
    [
      {
        id: "logs-stream",
        type: "logs.stream",
        name: "Log stream",
        widgetDescription: "Streaming log output with filter controls.",
        x: 24,
        y: 24,
        width: 1352,
        height: 932,
        title: "Log stream",
      },
    ],
  ),
] as const satisfies readonly DashboardScreenLayoutDefinition[];

export const DASHBOARD_SCREEN_LAYOUTS = Object.fromEntries(
  SCREEN_DEFINITIONS.map((definition) => [definition.key, definition]),
) as Record<DashboardScreenKey, DashboardScreenLayoutDefinition>;

export function isDashboardScreenKey(value?: string | null): value is DashboardScreenKey {
  return DASHBOARD_SCREEN_KEYS.includes(value as DashboardScreenKey);
}

export function getDashboardScreenLayoutDefinition(screenKey: DashboardScreenKey) {
  return DASHBOARD_SCREEN_LAYOUTS[screenKey];
}

export function getDashboardScreenLayoutDefinitionOrDefault(
  screenKey?: string | null,
) {
  return DASHBOARD_SCREEN_LAYOUTS[
    isDashboardScreenKey(screenKey) ? screenKey : "overview"
  ];
}

export function listDashboardScreenLayoutDefinitions() {
  return SCREEN_DEFINITIONS.map((definition) => ({
    ...definition,
    defaultConfig: cloneBuilderConfig(definition.defaultConfig),
    widgets: definition.widgets.map((widget) => ({ ...widget })),
  }));
}

export function buildDefaultDashboardScreenLayout(screenKey: DashboardScreenKey) {
  return cloneBuilderConfig(
    getDashboardScreenLayoutDefinition(screenKey).defaultConfig,
  );
}

export function getDashboardScreenKeyForPathname(pathname: string) {
  if (pathname === "/sessions") {
    return "chat";
  }

  return SCREEN_DEFINITIONS.find((definition) =>
    definition.path === "/"
      ? pathname === "/"
      : pathname === definition.path || pathname.startsWith(`${definition.path}/`),
  )?.key;
}
