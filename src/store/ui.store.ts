import { create } from 'zustand';
import {
  applyTheme,
  ensureNotificationPermission,
  readUiPrefs,
  writeUiPrefs,
  type UiPrefs,
} from '@/utils/uiPrefs';

export type FirstRunPhase = 'idle' | 'greeting' | 'docking' | 'docked' | 'collapsed' | 'done';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarPinned: boolean;
  sidebarVisible: boolean;
  sidebarHovering: boolean;
  firstRunPhase: FirstRunPhase;
  darkMode: boolean;
  notifications: boolean;
  autoSave: boolean;
  contextSheetOpen: boolean;

  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setNotifications: (enabled: boolean) => void;
  setAutoSave: (enabled: boolean) => void;
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
const initialPrefs: UiPrefs = typeof window !== 'undefined'
  ? readUiPrefs()
  : { darkMode: true, notifications: true, autoSave: true };

if (typeof window !== 'undefined') {
  applyTheme(initialPrefs.darkMode);
}

function persistPrefs(partial: Partial<UiPrefs>, get: () => UIState) {
  const next: UiPrefs = {
    darkMode: get().darkMode,
    notifications: get().notifications,
    autoSave: get().autoSave,
    ...partial,
  };
  writeUiPrefs(next);
  return next;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  sidebarCollapsed: welcomed && !pinned,
  sidebarPinned: pinned,
  sidebarVisible: welcomed,
  sidebarHovering: false,
  firstRunPhase: welcomed ? 'done' : 'greeting',
  darkMode: initialPrefs.darkMode,
  notifications: initialPrefs.notifications,
  autoSave: initialPrefs.autoSave,
  contextSheetOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleDarkMode: () => get().setDarkMode(!get().darkMode),
  setDarkMode: (dark) => {
    applyTheme(dark);
    persistPrefs({ darkMode: dark }, get);
    set({ darkMode: dark });
  },
  setNotifications: (enabled) => {
    persistPrefs({ notifications: enabled }, get);
    set({ notifications: enabled });
    if (enabled) {
      void ensureNotificationPermission();
    }
  },
  setAutoSave: (enabled) => {
    persistPrefs({ autoSave: enabled }, get);
    set({ autoSave: enabled });
  },
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
