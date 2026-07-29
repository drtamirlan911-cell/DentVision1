import { create } from 'zustand'

export type ContextFocus = 'workspace' | 'patient' | 'appointment' | 'product' | 'course' | 'analytics' | 'invoice' | 'lab'

interface WorkspaceState {
  context: {
    focusType: ContextFocus
    focusId: string | null
    data: Record<string, unknown>
    lastUpdated: number
  }

  onboarding: {
    completed: boolean
    currentScreen: number
    skipped: boolean
  }

  setContextFocus: (focusType: ContextFocus, focusId?: string | null, data?: Record<string, unknown>) => void
  setContextData: (data: Record<string, unknown>) => void
  clearContext: () => void

  setOnboardingComplete: (completed: boolean) => void
  setOnboardingScreen: (screen: number) => void
  setOnboardingSkipped: (skipped: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  context: {
    focusType: 'workspace',
    focusId: null,
    data: {},
    lastUpdated: Date.now(),
  },

  onboarding: {
    completed: (() => { try { return typeof window !== 'undefined' && !!sessionStorage.getItem('dv_welcomed') } catch { return false } })(),
    currentScreen: 0,
    skipped: false,
  },

  setContextFocus: (focusType, focusId = null, data = {}) => set({
    context: { focusType, focusId, data, lastUpdated: Date.now() },
  }),

  setContextData: (data) => set((state) => ({
    context: { ...state.context, data: { ...state.context.data, ...data }, lastUpdated: Date.now() },
  })),

  clearContext: () => set({
    context: { focusType: 'workspace', focusId: null, data: {}, lastUpdated: Date.now() },
  }),

  setOnboardingComplete: (completed) => {
    try {
      if (completed) sessionStorage.setItem('dv_welcomed', '1')
    } catch { /* ignore */ }
    set((state) => ({
      onboarding: { ...state.onboarding, completed },
    }))
  },

  setOnboardingScreen: (screen) => set((state) => ({
    onboarding: { ...state.onboarding, currentScreen: screen },
  })),

  setOnboardingSkipped: (skipped) => set((state) => ({
    onboarding: { ...state.onboarding, skipped },
  })),
}))
