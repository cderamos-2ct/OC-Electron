import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

export interface FileMetadata {
  name: string;
  ext: string;
  size: number;
  modified: string;
  absolutePath: string;
  relativePath: string;
  isGoogleDriveLink: boolean;
}

export type FileCategory =
  | "business"
  | "projects"
  | "reference"
  | "archive"
  | "finance"
  | "data"
  | "personal"
  | "research"
  | "unknown";

export type Confidence = "high" | "medium" | "low";

export interface ClassificationResult {
  file: FileMetadata;
  suggestedCategory: FileCategory;
  suggestedPath: string;
  confidence: Confidence;
  reasoning: string;
  conflictAtDestination: boolean;
}

export interface MoveResult {
  success: boolean;
  src: string;
  dst: string;
  dryRun: boolean;
  error?: string;
  auditEntry?: AuditLogEntry;
}

export interface AuditLogEntry {
  ts: number;
  src: string;
  dst: string;
  kind: "move" | "rename";
  confidence: Confidence;
  auto: boolean;
}

export interface DuplicateResult {
  existingPath: string;
  existingSize: number;
  existingModified: string;
  matchType: "exact-name" | "size-date";
}

export const DOCUMENTS_ROOT = "/Volumes/Storage/Home-Overflow/Documents";
export const INBOX_DIR = "/Volumes/Storage/Home-Overflow/Incoming-Review";
export const DOWNLOADS_DIR = "/Volumes/Storage/Home-Overflow/Downloads";
export const MOVE_LOG_DIR = "/Volumes/Storage/Home-Overflow/Move-Log";
export const GDRIVE_ROOT =
  process.env.HOME +
  "/Library/CloudStorage/GoogleDrive-christian@visualgraphx.com/My Drive";

export const GOOGLE_DRIVE_EXTENSIONS = new Set([
  ".gdoc",
  ".gsheet",
  ".gslides",
  ".gform",
  ".gscript",
  ".gdraw",
  ".gmap",
]);

const SEED_ACCOUNTS = [
  "2CT Media",
  "Clarity",
  "Hatco",
  "ServFlow",
  "ServRx",
  "Visual Graphx",
];

const FINANCE_KEYWORDS = [
  "invoice",
  "receipt",
  "tax",
  "w2",
  "1099",
  "timesheet",
  "payroll",
  "billing",
  "expense",
];

const BUSINESS_KEYWORDS = [
  "sow",
  "contract",
  "proposal",
  "nda",
  "agreement",
  "subcontractor",
  "vendor",
];

const PROJECT_KEYWORDS = [
  "spec",
  "draft",
  "wireframe",
  "mockup",
  "prototype",
  "design",
];

const REFERENCE_KEYWORDS = [
  "manual",
  "guide",
  "reference",
  "export",
  "readme",
  "documentation",
];

const RESEARCH_KEYWORDS = [
  "research",
  "analysis",
  "study",
  "report",
  "findings",
];

const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".csv", ".numbers"]);

const SCREENSHOT_PATTERN = /^(Screenshot .+\.png|Screen Recording .+\.mov|Simulator Screen Shot)/i;
const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/;

function boostConfidence(c: Confidence): Confidence {
  if (c === "low") return "medium";
  if (c === "medium") return "high";
  return "high";
}

function containsKeyword(lower: string, keywords: string[]): boolean {
  return keywords.some((kw) => lower.includes(kw));
}

function matchAccount(
  lower: string,
  accounts: string[]
): string | null {
  for (const account of accounts) {
    if (lower.includes(account.toLowerCase())) {
      return account;
    }
  }
  return null;
}

function sanitizeDirName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_.]/g, "").trim();
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateStringFromISO(iso: string): string {
  return iso.slice(0, 10);
}

function yearMonthFromISO(iso: string): string {
  return iso.slice(0, 7);
}

export async function scanDirectory(
  dirPath: string,
  options?: { recursive?: boolean; maxDepth?: number }
): Promise<FileMetadata[]> {
  const recursive = options?.recursive ?? false;
  const maxDepth = options?.maxDepth ?? 10;

  const results: FileMetadata[] = [];

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const absPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await walk(absPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      let stat;
      try {
        stat = await fs.stat(absPath);
      } catch {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();

      results.push({
        name: entry.name,
        ext,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        absolutePath: absPath,
        relativePath: path.relative(dirPath, absPath),
        isGoogleDriveLink: GOOGLE_DRIVE_EXTENSIONS.has(ext),
      });
    }
  }

  await walk(dirPath, 0);

  results.sort(
    (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
  );

  return results;
}

export function classifyFile(
  file: FileMetadata,
  knownAccounts?: string[]
): ClassificationResult {
  const accounts = knownAccounts ?? SEED_ACCOUNTS;
  const lower = file.name.toLowerCase();
  const hasDatePrefix = DATE_PREFIX_PATTERN.test(file.name);

  let category: FileCategory = "unknown";
  let confidence: Confidence = "low";
  let reasoning = "No matching classification rule";
  let matchedAccount: string | null = null;

  const accountMatch = matchAccount(lower, accounts);
  if (accountMatch) {
    category = "business";
    confidence = "high";
    reasoning = `Filename matches known account: ${accountMatch}`;
    matchedAccount = accountMatch;
  } else if (containsKeyword(lower, FINANCE_KEYWORDS)) {
    category = "finance";
    confidence = "high";
    reasoning = "Filename contains finance keyword";
  } else if (containsKeyword(lower, BUSINESS_KEYWORDS)) {
    category = "business";
    confidence = "high";
    reasoning = "Filename contains business document keyword";
  } else if (
    SPREADSHEET_EXTENSIONS.has(file.ext) &&
    containsKeyword(lower, FINANCE_KEYWORDS)
  ) {
    category = "finance";
    confidence = "high";
    reasoning = "Spreadsheet file with finance keyword";
  } else if (SPREADSHEET_EXTENSIONS.has(file.ext)) {
    category = "data";
    confidence = "medium";
    reasoning = "Spreadsheet file without finance keyword";
  } else if (file.isGoogleDriveLink) {
    if (containsKeyword(lower, FINANCE_KEYWORDS)) {
      category = "finance";
      confidence = "high";
      reasoning = "Google Drive link with finance keyword";
    } else if (containsKeyword(lower, BUSINESS_KEYWORDS)) {
      category = "business";
      confidence = "high";
      reasoning = "Google Drive link with business keyword";
    } else if (containsKeyword(lower, PROJECT_KEYWORDS)) {
      category = "projects";
      confidence = "medium";
      reasoning = "Google Drive link with project keyword";
    } else {
      category = "unknown";
      confidence = "low";
      reasoning = "Google Drive link, no matching keyword";
    }
  } else if (containsKeyword(lower, PROJECT_KEYWORDS)) {
    category = "projects";
    confidence = "medium";
    reasoning = "Filename contains project keyword";
  } else if (containsKeyword(lower, REFERENCE_KEYWORDS)) {
    category = "reference";
    confidence = "medium";
    reasoning = "Filename contains reference keyword";
  } else if (containsKeyword(lower, RESEARCH_KEYWORDS)) {
    category = "research";
    confidence = "medium";
    reasoning = "Filename contains research keyword";
  } else if (SCREENSHOT_PATTERN.test(file.name)) {
    category = "projects";
    confidence = "low";
    reasoning = "Screenshot or screen recording file";
  }

  if (hasDatePrefix && category !== "unknown") {
    confidence = boostConfidence(confidence);
    reasoning += " (date-prefixed filename)";
  }

  const suggestedPath = resolveSuggestedPath(file, category, matchedAccount, accounts);
  const destinationFile = path.join(suggestedPath, file.name);
  const conflictAtDestination = fsSync.existsSync(destinationFile);

  return {
    file,
    suggestedCategory: category,
    suggestedPath,
    confidence,
    reasoning,
    conflictAtDestination,
  };
}

function resolveSuggestedPath(
  file: FileMetadata,
  category: FileCategory,
  matchedAccount: string | null,
  accounts: string[]
): string {
  switch (category) {
    case "business": {
      if (matchedAccount) {
        return path.join(DOCUMENTS_ROOT, "Business", matchedAccount);
      }
      const lower = file.name.toLowerCase();
      const dynamicMatch = matchAccount(lower, accounts);
      if (dynamicMatch) {
        return path.join(DOCUMENTS_ROOT, "Business", dynamicMatch);
      }
      const sanitized = sanitizeDirName(path.parse(file.name).name);
      return path.join(DOCUMENTS_ROOT, "Business", sanitized);
    }
    case "finance":
      return path.join(DOCUMENTS_ROOT, "Finance");
    case "projects":
      return path.join(DOCUMENTS_ROOT, "Projects");
    case "reference":
      return path.join(DOCUMENTS_ROOT, "Reference");
    case "research":
      return path.join(DOCUMENTS_ROOT, "Research");
    case "data":
      return path.join(DOCUMENTS_ROOT, "Data");
    case "personal":
      return path.join(DOCUMENTS_ROOT, "Personal");
    case "archive": {
      const ym = yearMonthFromISO(file.modified);
      return path.join(DOCUMENTS_ROOT, "Archive", ym);
    }
    case "unknown":
    default:
      return file.absolutePath.replace(file.name, "").replace(/\/$/, "");
  }
}

export async function loadKnownAccounts(): Promise<string[]> {
  const businessDir = path.join(DOCUMENTS_ROOT, "Business");
  try {
    const entries = await fs.readdir(businessDir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
    return dirs.length > 0 ? dirs : SEED_ACCOUNTS;
  } catch {
    return SEED_ACCOUNTS;
  }
}

export async function executeMove(
  src: string,
  dst: string,
  options?: { dryRun?: boolean; auto?: boolean; confidence?: Confidence }
): Promise<MoveResult> {
  const dryRun = options?.dryRun ?? false;
  const auto = options?.auto ?? false;
  const confidence = options?.confidence ?? "low";

  if (!fsSync.existsSync(src)) {
    return { success: false, src, dst, dryRun, error: "Source file does not exist" };
  }

  if (fsSync.existsSync(dst)) {
    return { success: false, src, dst, dryRun, error: "Destination file already exists" };
  }

  if (dryRun) {
    return { success: true, src, dst, dryRun };
  }

  try {
    const dstDir = path.dirname(dst);
    await fs.mkdir(dstDir, { recursive: true });

    await fs.copyFile(src, dst);

    const srcStat = await fs.stat(src);
    const dstStat = await fs.stat(dst);

    if (srcStat.size !== dstStat.size) {
      await fs.unlink(dst).catch(() => undefined);
      return {
        success: false,
        src,
        dst,
        dryRun,
        error: "Size mismatch after copy — source not removed",
      };
    }

    await fs.unlink(src);

    const auditEntry: AuditLogEntry = {
      ts: Math.floor(Date.now() / 1000),
      src,
      dst,
      kind: "move",
      confidence,
      auto,
    };

    await appendAuditEntry(auditEntry);

    return { success: true, src, dst, dryRun, auditEntry };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, src, dst, dryRun, error: message };
  }
}

async function appendAuditEntry(entry: AuditLogEntry): Promise<void> {
  const date = new Date(entry.ts * 1000).toISOString().slice(0, 10);
  const logFile = path.join(MOVE_LOG_DIR, `moves-${date}.jsonl`);

  try {
    await fs.mkdir(MOVE_LOG_DIR, { recursive: true });
    await fs.appendFile(logFile, JSON.stringify(entry) + "\n");
  } catch {
    // audit failure is non-fatal
  }
}

export async function detectDuplicate(
  file: FileMetadata,
  destinationDir: string
): Promise<DuplicateResult | null> {
  const candidatePath = path.join(destinationDir, file.name);

  if (!fsSync.existsSync(candidatePath)) return null;

  let stat;
  try {
    stat = await fs.stat(candidatePath);
  } catch {
    return null;
  }

  const matchType: DuplicateResult["matchType"] =
    stat.size === file.size ? "size-date" : "exact-name";

  return {
    existingPath: candidatePath,
    existingSize: stat.size,
    existingModified: stat.mtime.toISOString(),
    matchType,
  };
}

export async function readAuditLog(
  date?: string,
  limit?: number,
  offset?: number
): Promise<AuditLogEntry[]> {
  const targetDate = date ?? todayString();
  const logFile = path.join(MOVE_LOG_DIR, `moves-${targetDate}.jsonl`);

  let raw: string;
  try {
    raw = await fs.readFile(logFile, "utf-8");
  } catch {
    return [];
  }

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const entries: AuditLogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as AuditLogEntry);
    } catch {
      // skip malformed lines
    }
  }

  const start = offset ?? 0;
  const end = limit !== undefined ? start + limit : undefined;

  return entries.slice(start, end);
}

export async function loadInboxState(): Promise<Record<string, string>> {
  const stateFile = path.join(MOVE_LOG_DIR, "inbox-state.json");
  try {
    const raw = await fs.readFile(stateFile, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function saveInboxState(
  state: Record<string, string>
): Promise<void> {
  const stateFile = path.join(MOVE_LOG_DIR, "inbox-state.json");
  await fs.mkdir(MOVE_LOG_DIR, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}

// re-export helper used internally but useful to callers
export { dateStringFromISO, todayString };
