// Bitwarden CLI adapter — wraps `bw` commands for Vaultwarden integration
// Session token is kept in memory only (never persisted to disk)

import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { homedir } from 'os';
import { SHELL_CONFIG_DIR_NAME, VAULT_SERVER_URL } from '../../shared/constants.js';

const execFileAsync = promisify(execFile);
const BW_BIN = process.env.BW_PATH ?? 'bw';
const MASTER_ENC_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, 'vault-master.enc');

export interface BwItem {
  id: string;
  name: string;
  type: number; // 1=login, 2=secure-note, 3=card, 4=identity
  folderId: string | null;
  login?: {
    username: string | null;
    password: string | null;
    uris?: Array<{ uri: string }>;
  };
  notes: string | null;
  fields?: Array<{ name: string; value: string; type: number }>;
  revisionDate: string;
  creationDate: string;
}

export interface BwFolder {
  id: string;
  name: string;
}

export class BwAdapter {
  private sessionToken: string | null = null;
  private serverUrl: string;

  constructor(serverUrl = VAULT_SERVER_URL) {
    this.serverUrl = serverUrl;
  }

  // ─── Session Management ─────────────────────────────────────────

  get isUnlocked(): boolean {
    return this.sessionToken !== null;
  }

  async configure(): Promise<void> {
    await this.bw('config', 'server', this.serverUrl);
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const { stdout } = await this.bw('login', email, password, '--raw');
      this.sessionToken = stdout.trim();
    } catch (err) {
      // Already logged in — try unlock instead
      if (String(err).includes('already logged in')) {
        await this.unlock(password);
      } else {
        throw err;
      }
    }
  }

  async unlock(password: string): Promise<void> {
    const { stdout } = await this.bw('unlock', password, '--raw');
    this.sessionToken = stdout.trim();
  }

  async lock(): Promise<void> {
    await this.bw('lock');
    this.sessionToken = null;
  }

  async logout(): Promise<void> {
    try {
      await this.bw('logout');
    } catch {
      // Ignore — may already be logged out
    }
    this.sessionToken = null;
  }

  async sync(): Promise<void> {
    await this.bwSession('sync');
  }

  async status(): Promise<{ serverUrl: string; status: string; userEmail: string | null }> {
    const { stdout } = await this.bw('status');
    return JSON.parse(stdout);
  }

  // ─── Item Operations ────────────────────────────────────────────

  async getItem(id: string): Promise<BwItem> {
    const { stdout } = await this.bwSession('get', 'item', id);
    return JSON.parse(stdout);
  }

  async listItems(folderId?: string): Promise<BwItem[]> {
    const args = ['list', 'items'];
    if (folderId) {
      args.push('--folderid', folderId);
    }
    const { stdout } = await this.bwSession(...args);
    return JSON.parse(stdout);
  }

  async searchItems(search: string): Promise<BwItem[]> {
    const { stdout } = await this.bwSession('list', 'items', '--search', search);
    return JSON.parse(stdout);
  }

  async createItem(item: Partial<BwItem>): Promise<BwItem> {
    const encoded = Buffer.from(JSON.stringify(item)).toString('base64');
    const { stdout } = await this.bwSession('create', 'item', encoded);
    return JSON.parse(stdout);
  }

  async editItem(id: string, item: Partial<BwItem>): Promise<BwItem> {
    const encoded = Buffer.from(JSON.stringify(item)).toString('base64');
    const { stdout } = await this.bwSession('edit', 'item', id, encoded);
    return JSON.parse(stdout);
  }

  async deleteItem(id: string): Promise<void> {
    await this.bwSession('delete', 'item', id);
  }

  // ─── Folder Operations ──────────────────────────────────────────

  async listFolders(): Promise<BwFolder[]> {
    const { stdout } = await this.bwSession('list', 'folders');
    return JSON.parse(stdout);
  }

  async createFolder(name: string): Promise<BwFolder> {
    const encoded = Buffer.from(JSON.stringify({ name })).toString('base64');
    const { stdout } = await this.bwSession('create', 'folder', encoded);
    return JSON.parse(stdout);
  }

  // ─── CLI Helpers ────────────────────────────────────────────────

  private async bw(...args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execFileAsync(BW_BIN, args, {
        timeout: 30_000,
        env: { ...process.env, BITWARDENCLI_APPDATA_DIR: join(homedir(), SHELL_CONFIG_DIR_NAME, 'bw-data') },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`bw CLI error: ${msg}`);
    }
  }

  private async bwSession(...args: string[]): Promise<{ stdout: string; stderr: string }> {
    if (!this.sessionToken) {
      throw new Error('Vault is locked. Call unlock() first.');
    }
    return this.bw(...args, '--session', this.sessionToken);
  }
}
