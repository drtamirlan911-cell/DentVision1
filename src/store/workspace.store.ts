import { create } from 'zustand'

interface WorkspaceState {
  sidebarCollapsed: boolean
  contextOpen: boolean
  activeModule: string
  setModule: (module: string) => void
  toggleSidebar: () => void
  toggleContext: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setContextOpen: (open: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  sidebarCollapsed: false,
  contextOpen: true,
  activeModule: 'intelligence',

  setModule: (module) => set({ activeModule: module }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  toggleContext: () => set((s) => ({ contextOpen: !s.contextOpen })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setContextOpen: (open) => set({ contextOpen: open }),
}))
