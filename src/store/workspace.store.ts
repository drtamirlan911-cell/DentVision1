import { create } from 'zustand';

export type AIStatus = 'idle' | 'thinking' | 'executing' | 'result' | 'confirmation' | 'error';
export type ContextFocus = 'workspace' | 'patient' | 'appointment' | 'product' | 'course' | 'analytics' | 'invoice' | 'lab';

export interface Intent {
  id: string;
  type: string;
  skill: string;
  entities: Record<string, unknown>;
  confidence: number;
}

export interface Action {
  id: string;
  type: string;
  label: string;
  confidence: number;
  params?: Record<string, unknown>;
  requiresConfirmation?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  skill?: string;
  source?: string;
  actions?: Action[];
  data?: Record<string, unknown>;
  recommendations?: Array<Record<string, unknown>>;
}

export interface SuggestionChip {
  id: string;
  label: string;
  action?: string;
}

export interface ProactiveAlert {
  id: string;
  type: string;
  category: string;
  text: string;
  priority: number;
  action?: { type: string };
  acknowledged?: boolean;
  resolved?: boolean;
}

interface AIWorkspaceState {
  ai: {
    status: AIStatus;
    currentIntent: Intent | null;
    currentAction: Action | null;
    messages: Message[];
    suggestions: SuggestionChip[];
    proactiveAlerts: ProactiveAlert[];
    progress: number;
    errorMessage: string | null;
  };

  context: {
    focusType: ContextFocus;
    focusId: string | null;
    data: Record<string, unknown>;
    lastUpdated: number;
  };

  onboarding: {
    completed: boolean;
    currentScreen: number;
    skipped: boolean;
  };

  setAIStatus: (status: AIStatus) => void;
  setCurrentIntent: (intent: Intent | null) => void;
  setCurrentAction: (action: Action | null) => void;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setSuggestions: (suggestions: SuggestionChip[]) => void;
  setSuggestionsFromStrings: (labels: string[]) => void;
  addProactiveAlert: (alert: ProactiveAlert) => void;
  setProactiveAlerts: (alerts: ProactiveAlert[]) => void;
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  setProgress: (progress: number) => void;
  setErrorMessage: (msg: string | null) => void;

  setContextFocus: (focusType: ContextFocus, focusId?: string | null, data?: Record<string, unknown>) => void;
  setContextData: (data: Record<string, unknown>) => void;
  clearContext: () => void;

  setOnboardingComplete: (completed: boolean) => void;
  setOnboardingScreen: (screen: number) => void;
  setOnboardingSkipped: (skipped: boolean) => void;

  resetAI: () => void;
}

export const useAIWorkspaceStore = create<AIWorkspaceState>((set) => ({
  ai: {
    status: 'idle',
    currentIntent: null,
    currentAction: null,
    messages: [],
    suggestions: [],
    proactiveAlerts: [],
    progress: 0,
    errorMessage: null,
  },

  context: {
    focusType: 'workspace',
    focusId: null,
    data: {},
    lastUpdated: Date.now(),
  },

  onboarding: {
    completed: (() => { try { return typeof window !== 'undefined' && !!sessionStorage.getItem('dv_welcomed'); } catch { return false; } })(),
    currentScreen: 0,
    skipped: false,
  },

  setAIStatus: (status) => set((state) => ({ ai: { ...state.ai, status } })),

  setCurrentIntent: (intent) => set((state) => ({ ai: { ...state.ai, currentIntent: intent } })),

  setCurrentAction: (action) => set((state) => ({ ai: { ...state.ai, currentAction: action } })),

  addMessage: (msg) => set((state) => ({
    ai: { ...state.ai, messages: [...state.ai.messages, msg] },
  })),

  setMessages: (msgs) => set((state) => ({ ai: { ...state.ai, messages: msgs } })),

  setSuggestions: (suggestions) => set((state) => ({ ai: { ...state.ai, suggestions } })),

  setSuggestionsFromStrings: (labels) => set((state) => ({
    ai: {
      ...state.ai,
      suggestions: labels.map((label, i) => ({ id: `s-${i}`, label })),
    },
  })),

  addProactiveAlert: (alert) => set((state) => ({
    ai: {
      ...state.ai,
      proactiveAlerts: [...state.ai.proactiveAlerts, alert]
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 8),
    },
  })),

  setProactiveAlerts: (alerts) => set((state) => ({ ai: { ...state.ai, proactiveAlerts: alerts } })),

  acknowledgeAlert: (id) => set((state) => ({
    ai: {
      ...state.ai,
      proactiveAlerts: state.ai.proactiveAlerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
    },
  })),

  resolveAlert: (id) => set((state) => ({
    ai: {
      ...state.ai,
      proactiveAlerts: state.ai.proactiveAlerts.map((a) =>
        a.id === id ? { ...a, resolved: true } : a
      ),
    },
  })),

  setProgress: (progress) => set((state) => ({ ai: { ...state.ai, progress } })),

  setErrorMessage: (msg) => set((state) => ({ ai: { ...state.ai, errorMessage: msg } })),

  setContextFocus: (focusType, focusId = null, data = {}) => set((state) => ({
    context: { focusType, focusId, data, lastUpdated: Date.now() },
  })),

  setContextData: (data) => set((state) => ({
    context: { ...state.context, data: { ...state.context.data, ...data }, lastUpdated: Date.now() },
  })),

  clearContext: () => set((state) => ({
    context: { focusType: 'workspace', focusId: null, data: {}, lastUpdated: Date.now() },
  })),

  setOnboardingComplete: (completed) => {
    try {
      if (completed) sessionStorage.setItem('dv_welcomed', '1');
    } catch { /* ignore */ }
    set((state) => ({
      onboarding: { ...state.onboarding, completed },
    }));
  },

  setOnboardingScreen: (screen) => set((state) => ({
    onboarding: { ...state.onboarding, currentScreen: screen },
  })),

  setOnboardingSkipped: (skipped) => set((state) => ({
    onboarding: { ...state.onboarding, skipped },
  })),

  resetAI: () => set((state) => ({
    ai: {
      status: 'idle',
      currentIntent: null,
      currentAction: null,
      messages: [],
      suggestions: [],
      proactiveAlerts: [],
      progress: 0,
      errorMessage: null,
    },
  })),
}));
