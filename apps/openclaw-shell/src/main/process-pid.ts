import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { SubsystemLogger } from './logging/logger.js';

const TERM_WAIT_MS = 1_500;
const KILL_WAIT_MS = 1_500;
const POLL_INTERVAL_MS = 100;

export async function cleanupStalePidFile(
  pidFile: string,
  serviceName: string,
  log: SubsystemLogger,
): Promise<void> {
  try {
    if (!existsSync(pidFile)) return;

    const stalePid = readPidFile(pidFile);
    if (stalePid !== null) {
      const terminated = await terminatePid(stalePid, serviceName, log);
      if (!terminated) {
        throw new Error(`Unable to stop stale ${serviceName} (PID ${stalePid})`);
      }
      log.info(`Killed stale ${serviceName} (PID ${stalePid})`);
    }

    unlinkSync(pidFile);
  } catch (err) {
    log.warn(`Stale ${serviceName} cleanup failed (non-fatal):`, err);
  }
}

export function writePidFile(
  pidFile: string,
  pid: number,
  log: SubsystemLogger,
): void {
  try {
    mkdirSync(dirname(pidFile), { recursive: true });
    writeFileSync(pidFile, String(pid), 'utf-8');
  } catch (err) {
    log.error(`Failed to write PID file ${pidFile}:`, err);
  }
}

export function removePidFile(
  pidFile: string,
  serviceName: string,
  log: SubsystemLogger,
): void {
  try {
    if (existsSync(pidFile)) {
      unlinkSync(pidFile);
    }
  } catch (err) {
    log.warn(`Failed to remove ${serviceName} PID file (non-fatal):`, err);
  }
}

export function readPidFile(pidFile: string): number | null {
  try {
    const pid = Number.parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function isPidRunning(pid: number | null): boolean {
  if (!pid || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminatePid(
  pid: number,
  serviceName: string,
  log: SubsystemLogger,
): Promise<boolean> {
  if (!isPidRunning(pid)) return true;

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return !isPidRunning(pid);
  }

  if (await waitForPidExit(pid, TERM_WAIT_MS)) {
    return true;
  }

  log.warn(`${serviceName} PID ${pid} ignored SIGTERM; escalating to SIGKILL.`);

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    return !isPidRunning(pid);
  }

  return waitForPidExit(pid, KILL_WAIT_MS);
}

async function waitForPidExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isPidRunning(pid)) {
      return true;
    }
    await delay(POLL_INTERVAL_MS);
  }
  return !isPidRunning(pid);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
