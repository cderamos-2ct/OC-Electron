// Renderer-process logger using electron-log renderer transport
// Forwards log entries to the main process via IPC

import electronLog from 'electron-log/renderer';
import { sanitizeLogArgs } from '../../shared/logging.js';

// Hook: sanitize before forwarding to main
electronLog.hooks.push((message) => {
  message.data = sanitizeLogArgs(message.data);
  return message;
});

// Console transport: dev only (packaged check not available in renderer without IPC,
// so we check process.env.NODE_ENV set by Vite)
if (import.meta.env.PROD) {
  electronLog.transports.console.level = false;
} else {
  electronLog.transports.console.level = 'debug';
}

export interface SubsystemLogger {
  error(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
}

export function createRendererLogger(subsystem: string): SubsystemLogger {
  const prefix = `[${subsystem}]`;
  return {
    error: (msg, ...args) => electronLog.error(prefix, msg, ...args),
    warn:  (msg, ...args) => electronLog.warn(prefix, msg, ...args),
    info:  (msg, ...args) => electronLog.info(prefix, msg, ...args),
    debug: (msg, ...args) => electronLog.debug(prefix, msg, ...args),
  };
}

export const rendererLogger = createRendererLogger('renderer');

export default electronLog;
