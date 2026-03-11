import fs from "node:fs";
import path from "node:path";
import type { BuilderConfig, BuilderTemplateMeta } from "@/lib/builder-types";
import { normalizeBuilderConfig } from "@/lib/builder-types";

const LOBSTERBOARD_ROOT = path.resolve(process.cwd(), "../LobsterBoard");
const LOBSTERBOARD_CONFIG_PATH = path.join(LOBSTERBOARD_ROOT, "config.json");
const LOBSTERBOARD_TEMPLATES_PATH = path.join(
  LOBSTERBOARD_ROOT,
  "templates",
  "templates.json",
);

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function getLobsterboardRoot() {
  return LOBSTERBOARD_ROOT;
}

export function getLobsterboardConfigPath() {
  return LOBSTERBOARD_CONFIG_PATH;
}

export function getLobsterboardTemplateDir(templateId: string) {
  return path.join(LOBSTERBOARD_ROOT, "templates", templateId);
}

export function getLobsterboardTemplateConfigPath(templateId: string) {
  return path.join(getLobsterboardTemplateDir(templateId), "config.json");
}

export function getLobsterboardTemplatePreviewPath(
  templateId: string,
  previewFileName?: string,
) {
  return path.join(
    getLobsterboardTemplateDir(templateId),
    previewFileName || "preview.png",
  );
}

export function readLobsterboardConfig() {
  return normalizeBuilderConfig(readJsonFile<BuilderConfig>(LOBSTERBOARD_CONFIG_PATH));
}

export function writeLobsterboardConfig(config: BuilderConfig) {
  const normalized = normalizeBuilderConfig(config);
  fs.writeFileSync(
    LOBSTERBOARD_CONFIG_PATH,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );
  return normalized;
}

export function readLobsterboardTemplates() {
  return readJsonFile<BuilderTemplateMeta[]>(LOBSTERBOARD_TEMPLATES_PATH);
}

export function readLobsterboardTemplate(templateId: string) {
  return normalizeBuilderConfig(
    readJsonFile<BuilderConfig>(getLobsterboardTemplateConfigPath(templateId)),
  );
}
