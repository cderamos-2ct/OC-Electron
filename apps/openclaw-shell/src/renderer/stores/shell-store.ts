import { create } from 'zustand';
import { ServiceConfig, ServiceState } from '../../shared/types';
import { DEFAULT_SERVICES, RAIL_DEFAULT_WIDTH } from '../../shared/constants';

// ─── Toast Types ──────────────────────────────────────────────────

export interface Toast {
  id: string;
  title: string;
  body: string;
  priority: 'info' | 'attention' | 'urgent';
  serviceId?: string;
  taskId?: string;
  createdAt: number;
}

export type AddToastInput = Omit<Toast, 'id' | 'createdAt'>;

// ─── Store Types ──────────────────────────────────────────────────

interface ShellState {
  activeServiceId: string;
  railVisible: boolean;
  railWidth: number;
  services: ServiceConfig[];
  serviceBadges: Map<string, number>;
  serviceStates: Record<string, ServiceState>;
  // Overlay state
  toasts: Toast[];
  actionPanelVisible: boolean;
  pendingActionCount: number;
}

interface ShellActions {
  setActiveService: (id: string) => void;
  toggleRail: () => void;
  setRailWidth: (w: number) => void;
  updateBadge: (serviceId: string, count: number) => void;
  addService: (config: ServiceConfig) => void;
  removeService: (id: string) => void;
  reorderServices: (orderedIds: string[]) => void;
  updateServiceState: (id: string, state: ServiceState) => void;
  // Overlay actions
  addToast: (input: AddToastInput) => void;
  removeToast: (id: string) => void;
  setActionPanelVisible: (visible: boolean) => void;
  setPendingActionCount: (count: number) => void;
}

type ShellStore = ShellState & ShellActions;

export const useShellStore = create<ShellStore>((set) => ({
  // State
  activeServiceId: 'openclaw-dashboard',
  railVisible: true,
  railWidth: RAIL_DEFAULT_WIDTH,
  services: DEFAULT_SERVICES as unknown as ServiceConfig[],
  serviceBadges: new Map<string, number>(),
  serviceStates: {},
  toasts: [],
  actionPanelVisible: false,
  pendingActionCount: 0,

  // Actions
  setActiveService: (id: string) => set({ activeServiceId: id }),

  toggleRail: () => set((state) => ({ railVisible: !state.railVisible })),

  setRailWidth: (w: number) => set({ railWidth: w }),

  updateBadge: (serviceId: string, count: number) =>
    set((state) => {
      const next = new Map(state.serviceBadges);
      next.set(serviceId, count);
      return { serviceBadges: next };
    }),

  addService: (config: ServiceConfig) =>
    set((state) => {
      if (state.services.find((s) => s.id === config.id)) return {};
      return { services: [...state.services, config] };
    }),

  removeService: (id: string) =>
    set((state) => {
      const next = state.services.filter((s) => s.id !== id);
      // If active tab was removed, switch to the nearest one
      let activeServiceId = state.activeServiceId;
      if (activeServiceId === id && next.length > 0) {
        const sorted = [...next].sort((a, b) => a.order - b.order);
        activeServiceId = sorted[0].id;
      }
      return { services: next, activeServiceId };
    }),

  reorderServices: (orderedIds: string[]) =>
    set((state) => {
      const map = new Map(state.services.map((s) => [s.id, s]));
      const reordered: ServiceConfig[] = [];
      orderedIds.forEach((id, idx) => {
        const s = map.get(id);
        if (s) reordered.push({ ...s, order: idx });
      });
      // append any services not listed
      state.services.forEach((s) => {
        if (!orderedIds.includes(s.id)) {
          reordered.push({ ...s, order: reordered.length });
        }
      });
      return { services: reordered };
    }),

  updateServiceState: (id: string, state: ServiceState) =>
    set((prev) => ({
      serviceStates: { ...prev.serviceStates, [id]: state },
    })),

  // Overlay actions
  addToast: (input: AddToastInput) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...input,
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
        },
      ],
    })),

  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setActionPanelVisible: (visible: boolean) => set({ actionPanelVisible: visible }),

  setPendingActionCount: (count: number) => set({ pendingActionCount: count }),
}));
