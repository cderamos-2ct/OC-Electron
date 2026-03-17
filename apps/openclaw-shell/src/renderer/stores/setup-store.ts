import { create } from 'zustand';
import type { BootstrapConfig } from '../views/setup/BootstrapOverlay';

export interface SetupState {
  setupComplete: boolean;
  setupLoading: boolean;
  bootstrapping: boolean;
  bootstrapConfig: BootstrapConfig | null;
  userName: string;
}

interface SetupActions {
  setSetupComplete: (complete: boolean) => void;
  setSetupLoading: (loading: boolean) => void;
  setBootstrapping: (bootstrapping: boolean, config?: BootstrapConfig | null) => void;
  setUserName: (name: string) => void;
}

type SetupStore = SetupState & SetupActions;

export const useSetupStore = create<SetupStore>((set) => ({
  setupComplete: false,
  setupLoading: true, // loading until we check
  bootstrapping: false,
  bootstrapConfig: null,
  userName: '',

  setSetupComplete: (complete) => set({ setupComplete: complete }),
  setSetupLoading: (loading) => set({ setupLoading: loading }),
  setBootstrapping: (bootstrapping, config) => set({
    bootstrapping,
    bootstrapConfig: config ?? null,
  }),
  setUserName: (name) => set({ userName: name }),
}));
