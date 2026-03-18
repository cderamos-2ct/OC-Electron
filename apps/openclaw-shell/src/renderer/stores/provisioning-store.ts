// Provisioning store — tracks wizard phase, per-component status, credentials

import { create } from 'zustand';

export type ProvisioningPhase = 'welcome' | 'system' | 'accounts' | 'permissions' | 'config' | 'verify';
export type ComponentStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface ComponentState {
  id: string;
  name: string;
  status: ComponentStatus;
  message: string;
  percent?: number;
}

export interface ProvisioningStoreState {
  // Phase tracking
  phase: ProvisioningPhase;
  setPhase: (phase: ProvisioningPhase) => void;

  // Data location
  dataDir: string;
  setDataDir: (dir: string) => void;

  // Per-component status
  components: ComponentState[];
  setComponentStatus: (id: string, status: ComponentStatus, message?: string, percent?: number) => void;
  initComponents: () => void;

  // Credential states
  githubPat: string;
  setGithubPat: (pat: string) => void;
  githubValid: boolean;
  setGithubValid: (valid: boolean) => void;
  gwsAuthed: boolean;
  setGwsAuthed: (authed: boolean) => void;

  // Overall state
  isProvisioning: boolean;
  setIsProvisioning: (v: boolean) => void;
  isComplete: boolean;
  setIsComplete: (v: boolean) => void;
}

const DEFAULT_COMPONENTS: ComponentState[] = [
  { id: 'paths', name: 'Data Directories', status: 'pending', message: '' },
  { id: 'postgres', name: 'PostgreSQL + pgvector', status: 'pending', message: '' },
  { id: 'vaultwarden', name: 'Vaultwarden', status: 'pending', message: '' },
  { id: 'gateway', name: 'OpenClaw Gateway', status: 'pending', message: '' },
  { id: 'gws', name: 'Google Workspace CLI', status: 'pending', message: '' },
  { id: 'credentials', name: 'Credentials', status: 'pending', message: '' },
  { id: 'dashboard', name: 'Dashboard', status: 'pending', message: '' },
  { id: 'code-server', name: 'code-server', status: 'pending', message: '' },
];

export const useProvisioningStore = create<ProvisioningStoreState>((set) => ({
  phase: 'welcome',
  setPhase: (phase) => set({ phase }),

  dataDir: '~/.aegilume',
  setDataDir: (dataDir) => set({ dataDir }),

  components: [...DEFAULT_COMPONENTS],
  setComponentStatus: (id, status, message, percent) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, status, message: message ?? c.message, percent } : c,
      ),
    })),
  initComponents: () => set({ components: [...DEFAULT_COMPONENTS] }),

  githubPat: '',
  setGithubPat: (githubPat) => set({ githubPat }),
  githubValid: false,
  setGithubValid: (githubValid) => set({ githubValid }),
  gwsAuthed: false,
  setGwsAuthed: (gwsAuthed) => set({ gwsAuthed }),

  isProvisioning: false,
  setIsProvisioning: (isProvisioning) => set({ isProvisioning }),
  isComplete: false,
  setIsComplete: (isComplete) => set({ isComplete }),
}));
