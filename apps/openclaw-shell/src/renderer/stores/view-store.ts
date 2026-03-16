import { create } from 'zustand';
import type { ViewId } from '@shared/types';

export type { ViewId };

interface ViewStore {
  activeView: ViewId;
  viewHistory: ViewId[];
  setActiveView: (view: ViewId) => void;
  goBack: () => void;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  activeView: 'home',
  viewHistory: [],

  setActiveView: (view) => {
    const { activeView, viewHistory } = get();
    if (view === activeView) return;
    set({
      activeView: view,
      viewHistory: [...viewHistory, activeView].slice(-20),
    });
  },

  goBack: () => {
    const { viewHistory } = get();
    if (viewHistory.length === 0) return;
    const prev = viewHistory[viewHistory.length - 1];
    set({
      activeView: prev,
      viewHistory: viewHistory.slice(0, -1),
    });
  },
}));
