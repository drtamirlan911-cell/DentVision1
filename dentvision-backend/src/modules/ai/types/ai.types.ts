export interface AIContext {
  userId: string;
  clinicId: string;
  role: string;
  currentPatientId?: string;
  currentAppointmentId?: string;
  sessionId: string;
  metadata: Record<string, unknown>;
}

export interface AIResponse {
  message: string;
  intent: string;
  action?: {
    type: string;
    payload: unknown;
  };
  contextUpdate?: {
    type: string;
    id: string;
  };
  suggestions: string[];
  needsConfirmation?: boolean;
  confirmData?: Record<string, unknown>;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AISession {
  id: string;
  userId: string;
  clinicId: string;
  messages: AIMessage[];
  context: AIContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  functionCall?: FunctionCall;
  functionResult?: unknown;
  timestamp: Date;
}

export interface MemoryEntry {
  key: string;
  value: unknown;
  scope: 'short' | 'session' | 'long';
  userId: string;
  clinicId: string;
  updatedAt: Date;
}

export interface ProactiveAlert {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  action?: {
    type: string;
    payload: Record<string, unknown>;
  };
}

export interface IntentResult {
  intent: string;
  confidence: number;
  parameters: Record<string, unknown>;
  needsConfirmation: boolean;
}