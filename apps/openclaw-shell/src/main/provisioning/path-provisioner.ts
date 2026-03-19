// Path provisioner — creates all required data directories and persists path config

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import {
  getDataDir,
  getPostgresDataDir,
  getGatewayDir,
  getCodeServerDir,
  getPathsConfigPath,
} from './platform.js';

export interface PathsConfig {
  dataDir: string;
  postgresData: string;
  gatewayDir: string;
  codeServerDir: string;
}

export class PathProvisioner implements Provisioner {
  readonly id = 'paths';
  readonly name = 'Data Directories';

  private paths: PathsConfig;

  constructor(customDataDir?: string) {
    const dataDir = customDataDir ?? getDataDir();
    this.paths = {
      dataDir,
      postgresData: customDataDir ? join(dataDir, 'postgres', 'data') : getPostgresDataDir(),
      gatewayDir: customDataDir ? join(dataDir, 'gateway') : getGatewayDir(),
      codeServerDir: customDataDir ? join(dataDir, 'code-server') : getCodeServerDir(),
    };
  }

  async check(): Promise<boolean> {
    return (
      existsSync(this.paths.dataDir) &&
      existsSync(this.paths.postgresData) &&
      existsSync(this.paths.gatewayDir) &&
      existsSync(this.paths.codeServerDir)
    );
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const dirs = [
      this.paths.dataDir,
      this.paths.postgresData,
      this.paths.gatewayDir,
      this.paths.codeServerDir,
      join(this.paths.dataDir, 'runtime'),
      join(this.paths.dataDir, 'data', 'tasks', 'items'),
      join(this.paths.dataDir, 'data', 'agents'),
    ];

    for (const dir of dirs) {
      onProgress?.({
        service: this.id,
        status: ProvisioningStatus.Running,
        message: `Creating ${dir}`,
      });
      mkdirSync(dir, { recursive: true });
    }

    // Persist path choices
    writeFileSync(getPathsConfigPath(), JSON.stringify(this.paths, null, 2), 'utf-8');

    onProgress?.({
      service: this.id,
      status: ProvisioningStatus.Success,
      message: 'All directories created',
    });
  }

  async start(): Promise<void> {
    // No-op — directories don't need starting
  }

  async stop(): Promise<void> {
    // No-op
  }

  getPaths(): PathsConfig {
    return this.paths;
  }

  static loadPaths(): PathsConfig | null {
    const configPath = getPathsConfigPath();
    if (!existsSync(configPath)) return null;
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8')) as PathsConfig;
    } catch {
      return null;
    }
  }
}
