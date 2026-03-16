// High-level vault adapter — maps OpenClaw secret names to Bitwarden items
// Uses custom fields to tag items with openclaw-secret-name for reliable lookup

import { BwAdapter } from './bw-adapter.js';
import type { BwItem, BwFolder } from './bw-adapter.js';
import type { VaultSecretMeta } from '../../shared/types.js';

const OPENCLAW_TAG_FIELD = 'openclaw-secret-name';

// Folder structure: openclaw/api-keys, openclaw/oauth, openclaw/tokens, openclaw/device-auth
const FOLDER_STRUCTURE = [
  'openclaw/api-keys',
  'openclaw/oauth',
  'openclaw/tokens',
  'openclaw/device-auth',
] as const;

export class VaultAdapter {
  private bw: BwAdapter;
  private folderMap = new Map<string, string>(); // name -> id
  private secretNameIndex = new Map<string, string>(); // openclaw-secret-name -> bw item id

  constructor(bw: BwAdapter) {
    this.bw = bw;
  }

  get isUnlocked(): boolean {
    return this.bw.isUnlocked;
  }

  // ─── Initialization ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    await this.bw.configure();
    await this.buildFolderMap();
    await this.buildSecretIndex();
  }

  private async buildFolderMap(): Promise<void> {
    const folders = await this.bw.listFolders();
    this.folderMap.clear();
    for (const folder of folders) {
      this.folderMap.set(folder.name, folder.id);
    }
  }

  async ensureFolderStructure(): Promise<void> {
    for (const folderName of FOLDER_STRUCTURE) {
      if (!this.folderMap.has(folderName)) {
        const folder = await this.bw.createFolder(folderName);
        this.folderMap.set(folder.name, folder.id);
      }
    }
  }

  private async buildSecretIndex(): Promise<void> {
    this.secretNameIndex.clear();
    const items = await this.bw.listItems();
    for (const item of items) {
      const tag = item.fields?.find((f) => f.name === OPENCLAW_TAG_FIELD);
      if (tag) {
        this.secretNameIndex.set(tag.value, item.id);
      }
    }
  }

  // ─── Secret Operations ──────────────────────────────────────────

  async getSecret(name: string): Promise<string | null> {
    const itemId = this.secretNameIndex.get(name);
    if (!itemId) return null;

    const item = await this.bw.getItem(itemId);
    // Return password for login items, notes for secure notes
    if (item.type === 1 && item.login?.password) {
      return item.login.password;
    }
    if (item.type === 2 && item.notes) {
      return item.notes;
    }
    return item.notes ?? item.login?.password ?? null;
  }

  async setSecret(name: string, value: string, folder?: string): Promise<string> {
    const folderId = folder ? (this.folderMap.get(folder) ?? null) : null;
    const existingId = this.secretNameIndex.get(name);

    if (existingId) {
      // Update existing
      const existing = await this.bw.getItem(existingId);
      const updated: Partial<BwItem> = {
        ...existing,
        login: { ...existing.login, username: existing.login?.username ?? null, password: value },
      };
      const result = await this.bw.editItem(existingId, updated);
      return result.id;
    }

    // Create new login item with openclaw tag
    const item: Partial<BwItem> = {
      type: 1, // login
      name,
      folderId,
      login: { username: null, password: value },
      notes: null,
      fields: [{ name: OPENCLAW_TAG_FIELD, value: name, type: 0 }],
    };
    const result = await this.bw.createItem(item);
    this.secretNameIndex.set(name, result.id);
    return result.id;
  }

  async deleteSecret(name: string): Promise<boolean> {
    const itemId = this.secretNameIndex.get(name);
    if (!itemId) return false;
    await this.bw.deleteItem(itemId);
    this.secretNameIndex.delete(name);
    return true;
  }

  async listSecrets(folder?: string): Promise<VaultSecretMeta[]> {
    const folderId = folder ? this.folderMap.get(folder) : undefined;
    const items = await this.bw.listItems(folderId);

    return items
      .filter((item) => item.fields?.some((f) => f.name === OPENCLAW_TAG_FIELD))
      .map((item) => {
        const tag = item.fields!.find((f) => f.name === OPENCLAW_TAG_FIELD)!;
        const folderName = this.getFolderName(item.folderId);
        return {
          id: item.id,
          name: tag.value,
          folder: folderName ?? 'uncategorized',
          lastRotatedAt: null, // tracked by rotation scheduler, not bw
          createdAt: item.creationDate,
          updatedAt: item.revisionDate,
          hasActiveLease: false, // populated by lease cache
        };
      });
  }

  async getSecretCount(): Promise<number> {
    return this.secretNameIndex.size;
  }

  // ─── Sync ───────────────────────────────────────────────────────

  async sync(): Promise<void> {
    await this.bw.sync();
    await this.buildSecretIndex();
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private getFolderName(folderId: string | null): string | null {
    if (!folderId) return null;
    for (const [name, id] of this.folderMap) {
      if (id === folderId) return name;
    }
    return null;
  }
}
