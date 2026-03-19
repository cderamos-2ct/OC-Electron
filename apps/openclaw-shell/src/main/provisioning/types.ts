// Provisioning system types — shared across all provisioners

export enum ProvisioningStatus {
  Pending = 'pending',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Skipped = 'skipped',
}

export interface ProvisioningProgress {
  service: string;
  status: ProvisioningStatus;
  message: string;
  percent?: number;
}

export interface ProvisioningStepState {
  status: ProvisioningStatus;
  message: string;
  completedAt?: string;
  error?: string;
}

export interface ProvisioningState {
  version: number;
  startedAt: string;
  completedAt?: string;
  steps: Record<string, ProvisioningStepState>;
}

export interface Provisioner {
  /** Unique service identifier (e.g., 'postgres', 'gateway') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Check if the service is already provisioned and healthy */
  check(): Promise<boolean>;

  /** Install/configure the service from scratch */
  provision(onProgress?: (progress: ProvisioningProgress) => void): Promise<void>;

  /** Start the service (e.g., pg_ctl start) */
  start(): Promise<void>;

  /** Stop the service gracefully */
  stop(): Promise<void>;
}

export interface ProvisioningConfig {
  dataDir: string;
  postgresPort: number;
  dashboardPort: number;
  codeServerPort: number;
  useExternalPostgres: boolean;
  externalPostgresUrl?: string;
}

export const DEFAULT_PROVISIONING_CONFIG: ProvisioningConfig = {
  dataDir: '', // resolved at runtime via platform.ts
  postgresPort: 5432,
  dashboardPort: 3000,
  codeServerPort: 8443,
  useExternalPostgres: false,
};
