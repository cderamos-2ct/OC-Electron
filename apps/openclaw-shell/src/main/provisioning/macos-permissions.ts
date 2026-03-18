// macOS permission detection — probes system permissions via filesystem tests + osascript

import { execFile } from 'child_process';
import { promisify } from 'util';
import { readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createLogger } from '../logging/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('MacOSPermissions');

export interface PermissionStatus {
  name: string;
  id: string;
  granted: boolean;
  deepLink: string;
  description: string;
}

const PERMISSIONS: Array<{ id: string; name: string; description: string; deepLink: string }> = [
  {
    id: 'full-disk-access',
    name: 'Full Disk Access',
    description: 'Required for reading files across the system',
    deepLink: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
  },
  {
    id: 'contacts',
    name: 'Contacts',
    description: 'For contact sync and people intelligence',
    deepLink: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'For calendar event management',
    deepLink: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars',
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'For UI automation and keyboard shortcuts',
    deepLink: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'For controlling other applications',
    deepLink: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  },
];

async function checkFullDiskAccess(): Promise<boolean> {
  try {
    // Attempt to read a protected directory
    readdirSync(join(homedir(), 'Library', 'Mail'));
    return true;
  } catch {
    return false;
  }
}

async function checkContacts(): Promise<boolean> {
  try {
    await execFileAsync('osascript', ['-e', 'tell application "Contacts" to count every person'], {
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

async function checkCalendar(): Promise<boolean> {
  try {
    await execFileAsync('osascript', ['-e', 'tell application "Calendar" to count every calendar'], {
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

async function checkAccessibility(): Promise<boolean> {
  try {
    // Check AXIsProcessTrusted via a shell helper
    const { stdout } = await execFileAsync('osascript', [
      '-e', 'tell application "System Events" to get name of first process',
    ], { timeout: 5_000 });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function checkAutomation(): Promise<boolean> {
  try {
    await execFileAsync('osascript', [
      '-e', 'tell application "Finder" to get name of front window',
    ], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

const checkers: Record<string, () => Promise<boolean>> = {
  'full-disk-access': checkFullDiskAccess,
  'contacts': checkContacts,
  'calendar': checkCalendar,
  'accessibility': checkAccessibility,
  'automation': checkAutomation,
};

/** Check all macOS permissions. Returns empty array on non-macOS. */
export async function checkAllPermissions(): Promise<PermissionStatus[]> {
  if (process.platform !== 'darwin') return [];

  const results: PermissionStatus[] = [];

  for (const perm of PERMISSIONS) {
    let granted = false;
    try {
      const checker = checkers[perm.id];
      if (checker) {
        granted = await checker();
      }
    } catch (err) {
      log.warn(`Permission check for ${perm.id} failed:`, err);
    }

    results.push({
      ...perm,
      granted,
    });
  }

  return results;
}

/** Check a single permission by id */
export async function checkPermission(id: string): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  const checker = checkers[id];
  if (!checker) return false;
  try {
    return await checker();
  } catch {
    return false;
  }
}

/** Get the deep link URL for a specific permission */
export function getPermissionDeepLink(id: string): string | null {
  return PERMISSIONS.find((p) => p.id === id)?.deepLink ?? null;
}

/** Get all permission definitions */
export function getPermissionDefinitions(): typeof PERMISSIONS {
  return PERMISSIONS;
}
