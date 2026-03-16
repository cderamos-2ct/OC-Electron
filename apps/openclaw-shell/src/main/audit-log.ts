// Append-only JSONL audit log for CD actions
// File: .antigravity/runtime/cd-actions.jsonl

import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { RUNTIME_DIR, AUDIT_LOG_FILE } from '../shared/constants.js';
import type { AuditLogEntry } from '../shared/types.js';

const AUDIT_LOG_PATH = `${RUNTIME_DIR}/${AUDIT_LOG_FILE}`;

function ensureDir(): void {
  const dir = dirname(AUDIT_LOG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function appendAuditEntry(entry: AuditLogEntry): void {
  ensureDir();
  const line = JSON.stringify(entry) + '\n';
  appendFileSync(AUDIT_LOG_PATH, line, 'utf-8');
}

export function readAuditLog(limit = 100): AuditLogEntry[] {
  if (!existsSync(AUDIT_LOG_PATH)) return [];
  try {
    const raw = readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as AuditLogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditLogEntry => e !== null);
    // Return most recent first, limited
    return entries.slice(-limit).reverse();
  } catch {
    return [];
  }
}
