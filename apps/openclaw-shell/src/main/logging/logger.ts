// Main-process structured logger using electron-log
// File transport: 5 MB cap, 5 rotated files
// Console transport: development only
// PII sanitizer applied to all log calls

import electronLog from 'electron-log/main';
import { join } from 'path';
import { app } from 'electron';
import { sanitizeLogArgs } from '../../shared/logging.js';

// ── Transport configuration ──────────────────────────────────────────────────

function configureLogger(): void {
  // File transport — always enabled
  electronLog.transports.file.level = 'info';
  electronLog.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB
  electronLog.transports.file.archiveLog = (oldLogFile) => {
    // Keep up to 5 rotated files
    const base = oldLogFile.toString().replace(/\.log$/, '');
    return `${base}.1.log` as unknown as Parameters<typeof electronLog.transports.file.archiveLog>[0];
  };

  // Set log directory to userData for packaged apps
  try {
    const logDir = join(app.getPath('userData'), 'logs');
    electronLog.transports.file.resolvePathFn = () => join(logDir, 'openclaw.log');
  } catch {
    // app may not be ready yet during tests; use default path
  }

  // Console transport — development only
  if (app.isPackaged) {
    electronLog.transports.console.level = false;
  } else {
    electronLog.transports.console.level = 'debug';
  }

  // Hook: sanitize all messages before writing
  electronLog.hooks.push((message) => {
    message.data = sanitizeLogArgs(message.data);
    return message;
  });

  electronLog.initialize();
}

configureLogger();

// ── Subsystem logger factory ─────────────────────────────────────────────────

export interface SubsystemLogger {
  error(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
}

export function createLogger(subsystem: string): SubsystemLogger {
  const prefix = `[${subsystem}]`;
  return {
    error: (msg, ...args) => electronLog.error(prefix, msg, ...args),
    warn:  (msg, ...args) => electronLog.warn(prefix, msg, ...args),
    info:  (msg, ...args) => electronLog.info(prefix, msg, ...args),
    debug: (msg, ...args) => electronLog.debug(prefix, msg, ...args),
  };
}

// Audit subsystem — logs at 'info' level with [audit] prefix
export const auditLogger = createLogger('audit');

// Default app logger
export const logger = createLogger('app');

export default electronLog;
