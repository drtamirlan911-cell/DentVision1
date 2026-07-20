import { create } from 'zustand';

export type FirstRunPhase = 'idle' | 'greeting' | 'docking' | 'docked' | 'collapsed' | 'done';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarPinned: boolean;
  sidebarVisible: boolean;
  sidebarHovering: boolean;
  firstRunPhase: FirstRunPhase;
  darkMode: boolean;
  contextSheetOpen: boolean;

  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarPinned: (pinned: boolean) => void;
  setSidebarVisible: (visible: boolean) => void;
  setSidebarHovering: (hovering: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setFirstRunPhase: (phase: FirstRunPhase) => void;
  setContextSheetOpen: (open: boolean) => void;
  completeFirstRun: () => void;
}

const readPinned = () => {
  try {
    return localStorage.getItem('dv_sidebar_pinned') === '1';
  } catch {
    return false;
  }
};

const readWelcomed = () => {
  try {
    return !!sessionStorage.getItem('dv_welcomed');
  } catch {
    return false;
  }
};

const welcomed = typeof window !== 'undefined' ? readWelcomed() : false;
const pinned = typeof window !== 'undefined' ? readPinned() : false;

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  sidebarCollapsed: welcomed && !pinned,
  sidebarPinned: pinned,
  sidebarVisible: welcomed,
  sidebarHovering: false,
  firstRunPhase: welcomed ? 'done' : 'greeting',
  darkMode: true,
  contextSheetOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarPinned: (pinned) => {
    try {
      localStorage.setItem('dv_sidebar_pinned', pinned ? '1' : '0');
    } catch { /* ignore */ }
    set({ sidebarPinned: pinned, sidebarCollapsed: pinned ? false : get().sidebarCollapsed });
  },
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setSidebarHovering: (hovering) => set({ sidebarHovering: hovering }),
  toggleSidebarCollapsed: () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    if (!next) get().setSidebarPinned(true);
  },
  setFirstRunPhase: (phase) => set({ firstRunPhase: phase }),
  setContextSheetOpen: (open) => set({ contextSheetOpen: open }),
  completeFirstRun: () => {
    try {
      sessionStorage.setItem('dv_welcomed', '1');
    } catch { /* ignore */ }
    set({ firstRunPhase: 'done' });
  },
}));
