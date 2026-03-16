#!/usr/bin/env node

/**
 * File Inbox Watcher — cron-based sweep
 * Runs every 30 min (or on-demand) to classify and auto-file inbox items.
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";

// --- Constants (mirrored from dashboard/lib/file-classification.ts) ---

const DOCUMENTS_ROOT = "/Volumes/Storage/Home-Overflow/Documents";
const INBOX_DIR = "/Volumes/Storage/Home-Overflow/Incoming-Review";
const DOWNLOADS_DIR = "/Volumes/Storage/Home-Overflow/Downloads";
const MOVE_LOG_DIR = "/Volumes/Storage/Home-Overflow/Move-Log";
const HOME_DOWNLOADS = path.join(os.homedir(), "Downloads");

const GOOGLE_DRIVE_EXTENSIONS = new Set([
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
const SCREENSHOT_PATTERN =
  /^(Screenshot .+\.png|Screen Recording .+\.mov|Simulator Screen Shot)/i;
const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/;

// --- Helper functions ---

function boostConfidence(c) {
  if (c === "low") return "medium";
  if (c === "medium") return "high";
  return "high";
}

function containsKeyword(lower, keywords) {
  return keywords.some((kw) => lower.includes(kw));
}

function matchAccount(lower, accounts) {
  for (const account of accounts) {
    if (lower.includes(account.toLowerCase())) {
      return account;
    }
  }
  return null;
}

function sanitizeDirName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-_.]/g, "").trim();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function yearMonthFromISO(iso) {
  return iso.slice(0, 7);
}

// --- scanDirectory ---

async function scanDirectory(dirPath, options) {
  const recursive = options?.recursive ?? false;
  const maxDepth = options?.maxDepth ?? 10;

  const results = [];

  async function walk(currentPath, depth) {
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

// --- resolveSuggestedPath ---

function resolveSuggestedPath(file, category, matchedAccount, accounts) {
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

// --- classifyFile ---

function classifyFile(file, knownAccounts) {
  const accounts = knownAccounts ?? SEED_ACCOUNTS;
  const lower = file.name.toLowerCase();
  const hasDatePrefix = DATE_PREFIX_PATTERN.test(file.name);

  let category = "unknown";
  let confidence = "low";
  let reasoning = "No matching classification rule";
  let matchedAccount = null;

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

// --- loadKnownAccounts ---

async function loadKnownAccounts() {
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

// --- appendAuditEntry ---

async function appendAuditEntry(entry) {
  const date = new Date(entry.ts * 1000).toISOString().slice(0, 10);
  const logFile = path.join(MOVE_LOG_DIR, `moves-${date}.jsonl`);

  try {
    await fs.mkdir(MOVE_LOG_DIR, { recursive: true });
    await fs.appendFile(logFile, JSON.stringify(entry) + "\n");
  } catch {
    // audit failure is non-fatal
  }
}

// --- executeMove ---

async function executeMove(src, dst, options) {
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

    const auditEntry = {
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

// --- loadInboxState / saveInboxState ---

async function loadInboxState() {
  const stateFile = path.join(MOVE_LOG_DIR, "inbox-state.json");
  try {
    const raw = await fs.readFile(stateFile, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveInboxState(state) {
  const stateFile = path.join(MOVE_LOG_DIR, "inbox-state.json");
  await fs.mkdir(MOVE_LOG_DIR, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}

// --- Main ---

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] File inbox watcher starting...`);

  const accounts = await loadKnownAccounts();
  const inboxState = await loadInboxState();

  // Scan all inbox directories
  const dirs = [INBOX_DIR, DOWNLOADS_DIR];

  // Optionally include ~/Downloads if it's not a symlink to the same place
  if (fsSync.existsSync(HOME_DOWNLOADS)) {
    const realHome = fsSync.realpathSync(HOME_DOWNLOADS);
    const realDownloads = fsSync.existsSync(DOWNLOADS_DIR)
      ? fsSync.realpathSync(DOWNLOADS_DIR)
      : "";
    if (realHome !== realDownloads) {
      dirs.push(HOME_DOWNLOADS);
    }
  }

  let processed = 0;
  let autoFiled = 0;
  let flagged = 0;
  let skipped = 0;

  for (const dir of dirs) {
    const files = await scanDirectory(dir);

    for (const file of files) {
      // Skip already-processed files
      const state = inboxState[file.absolutePath];
      if (state === "approved" || state === "rejected" || state === "auto-filed") {
        skipped++;
        continue;
      }

      const result = classifyFile(file, accounts);
      processed++;

      // Auto-file high-confidence items with no conflict
      if (
        result.confidence === "high" &&
        !result.conflictAtDestination &&
        result.suggestedCategory !== "unknown"
      ) {
        const dstFile = path.join(result.suggestedPath, file.name);
        const moveResult = await executeMove(file.absolutePath, dstFile, {
          auto: true,
          confidence: "high",
        });

        if (moveResult.success) {
          inboxState[file.absolutePath] = "auto-filed";
          autoFiled++;
          console.log(
            `  AUTO-FILED: ${file.name} → ${result.suggestedCategory}/${path.basename(result.suggestedPath)}/`
          );
        } else {
          inboxState[file.absolutePath] = "pending";
          flagged++;
          console.log(`  FAILED: ${file.name} — ${moveResult.error}`);
        }
      } else {
        // Flag for manual review
        inboxState[file.absolutePath] = "pending";
        flagged++;
        console.log(
          `  FLAGGED: ${file.name} → ${result.suggestedCategory} (${result.confidence}) — ${result.reasoning}`
        );
      }
    }
  }

  await saveInboxState(inboxState);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[${new Date().toISOString()}] Done in ${elapsed}s — ${processed} processed, ${autoFiled} auto-filed, ${flagged} flagged, ${skipped} skipped`
  );
}

main().catch((err) => {
  console.error("File inbox watcher error:", err);
  process.exit(1);
});
