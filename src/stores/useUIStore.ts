import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  darkMode: boolean;
  contextSheetOpen: boolean;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setSidebarOpen: (open: boolean) => void;
  setContextSheetOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  darkMode: true,
  contextSheetOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setContextSheetOpen: (open) => set({ contextSheetOpen: open }),
}));
