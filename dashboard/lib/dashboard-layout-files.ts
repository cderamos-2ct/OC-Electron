import fs from "node:fs";
import path from "node:path";
import type { BuilderConfig } from "@/lib/builder-types";
import { normalizeBuilderConfig } from "@/lib/builder-types";
import {
  buildDefaultDashboardScreenLayout,
  getDashboardScreenLayoutDefinition,
  isDashboardScreenKey,
  type DashboardScreenKey,
} from "@/lib/dashboard-screen-layouts";

const DATA_ROOT = path.resolve(process.cwd(), "data");
const LAYOUTS_PATH = path.join(DATA_ROOT, "dashboard-layouts.json");

type StoredDashboardLayouts = Partial<Record<DashboardScreenKey, BuilderConfig>>;

function ensureDataRoot() {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
}

function readStoredLayouts(): StoredDashboardLayouts {
  ensureDataRoot();

  if (!fs.existsSync(LAYOUTS_PATH)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(LAYOUTS_PATH, "utf8")) as StoredDashboardLayouts;
}

function writeStoredLayouts(layouts: StoredDashboardLayouts) {
  ensureDataRoot();
  fs.writeFileSync(LAYOUTS_PATH, `${JSON.stringify(layouts, null, 2)}\n`, "utf8");
}

export function getDashboardLayoutsPath() {
  return LAYOUTS_PATH;
}

export function readDashboardScreenLayout(screenKey: DashboardScreenKey) {
  const storedLayouts = readStoredLayouts();
  return normalizeBuilderConfig(
    storedLayouts[screenKey] ?? buildDefaultDashboardScreenLayout(screenKey),
  );
}

export function writeDashboardScreenLayout(
  screenKey: DashboardScreenKey,
  config: BuilderConfig,
) {
  const storedLayouts = readStoredLayouts();
  const normalized = normalizeBuilderConfig(config);

  storedLayouts[screenKey] = normalized;
  writeStoredLayouts(storedLayouts);

  return normalized;
}

export function resetDashboardScreenLayout(screenKey: DashboardScreenKey) {
  return writeDashboardScreenLayout(
    screenKey,
    buildDefaultDashboardScreenLayout(screenKey),
  );
}

export function readDashboardScreenLayoutDefinition(input: string) {
  if (!isDashboardScreenKey(input)) {
    throw new Error(`Unknown dashboard screen: ${input}`);
  }

  return getDashboardScreenLayoutDefinition(input);
}
