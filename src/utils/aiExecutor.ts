import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { aiAction } from '@/utils/api';
import { useAuth } from '@/store/auth.store';
import type { Message } from '@/store/workspace.store';
import { AI_NAV_ACTIONS } from '@/lib/aiPlatformMap';

export interface AIAction {
  id: string;
  type: string;
  label: string;
  confidence: number;
  params?: Record<string, unknown>;
  requiresConfirmation?: boolean;
}

export interface ActionResult {
  type: 'navigate' | 'data' | 'created' | 'updated' | 'report' | 'recommendation' | 'error';
  path?: string;
  data?: any;
  label?: string;
  message?: string;
}

export interface ExecutorCallbacks {
  onNavigate?: (path: string) => void;
  onData?: (data: any, label: string) => void;
  onCreated?: (data: any, label: string) => void;
  onUpdated?: (data: any, label: string) => void;
  onReport?: (data: any, label: string) => void;
  onRecommendation?: (data: any, label: string) => void;
  onError?: (message: string) => void;
  onConfirm?: (action: AIAction) => Promise<boolean>;
  addMessage?: (message: Partial<Message>) => void;
}

const NAVIGATION_ACTIONS: Record<string, string> = {
  ...AI_NAV_ACTIONS,
  NAVIGATE: '', // path comes from params.path
};

export function resolveNavigationPath(
  type: string,
  params?: Record<string, unknown>,
): string | null {
  if (params && typeof params.path === 'string' && params.path) {
    return params.path;
  }
  if (type === 'NAVIGATE') {
    return null;
  }
  const mapped = NAVIGATION_ACTIONS[type];
  return mapped || null;
}

export function useAIExecutor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clinic } = useAuth();

  const executeAction = async (
    action: AIAction,
    callbacks: ExecutorCallbacks = {}
  ): Promise<ActionResult | null> => {
    const { onConfirm, addMessage } = callbacks;

    if (action.requiresConfirmation) {
      const confirmed = await onConfirm?.(action);
      if (!confirmed) return null;
    }

    try {
      // Pure navigation intents — resolve locally so OPEN_SCHEDULE / OpenSchedule both work
      // without a round-trip that can fail and leave the chat button dead.
      const localPath = resolveNavigationPath(action.type, action.params);
      if (localPath) {
        callbacks.onNavigate?.(localPath);
        navigate(localPath);
        return { type: 'navigate', path: localPath, label: action.label };
      }

      const result = await aiAction(action.type, action.params || {});

      switch (result.type) {
        case 'navigate':
          if (result.path) {
            callbacks.onNavigate?.(result.path);
            navigate(result.path);
          }
          return result;

        case 'data':
          callbacks.onData?.(result.data, result.label);
          addMessage?.({
            role: 'assistant',
            content: `${result.label}:`,
            timestamp: new Date(),
            data: result.data,
          });
          return result;

        case 'created':
          callbacks.onCreated?.(result.data, result.label);
          queryClient.invalidateQueries({ queryKey: ['patients'] });
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
          queryClient.invalidateQueries({ queryKey: ['labOrders'] });
          queryClient.invalidateQueries({ queryKey: ['receipts'] });
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
          addMessage?.({
            role: 'assistant',
            content: `${result.label}: ${JSON.stringify(result.data)}`,
            timestamp: new Date(),
            data: result.data,
          });
          return result;

        case 'updated':
          callbacks.onUpdated?.(result.data, result.label);
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
          addMessage?.({
            role: 'assistant',
            content: `${result.label}`,
            timestamp: new Date(),
            data: result.data,
          });
          return result;

        case 'report':
          callbacks.onReport?.(result.data, result.label);
          addMessage?.({
            role: 'assistant',
            content: `${result.label}`,
            timestamp: new Date(),
            data: result.data,
          });
          return result;

        case 'recommendation':
          callbacks.onRecommendation?.(result.data, result.label);
          addMessage?.({
            role: 'assistant',
            content: `${result.label}`,
            timestamp: new Date(),
            data: result.data,
          });
          return result;

        case 'error':
          callbacks.onError?.(result.message || 'Ошибка выполнения');
          return result;

        default:
          return result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      callbacks.onError?.(message);
      return { type: 'error', message };
    }
  };

  const executeNavigation = (actionType: string): string | null => {
    const path = NAVIGATION_ACTIONS[actionType];
    if (path) {
      navigate(path);
      return path;
    }
    return null;
  };

  const getAvailableActions = () => {
    const role = user?.platformRole || user?.role || 'guest';
    return NAVIGATION_ACTIONS;
  };

  return {
    executeAction,
    executeNavigation,
    getAvailableActions,
  };
}

export function extractNavigationAction(action: AIAction): string | null {
  return resolveNavigationPath(action.type, action.params);
}

export function isNavigationAction(action: AIAction): boolean {
  return Boolean(resolveNavigationPath(action.type, action.params)) || action.type in NAVIGATION_ACTIONS;
}

export function isDataAction(action: AIAction): boolean {
  return [
    'SearchPatients',
    'GetTodaySchedule',
    'GetClinicStats',
    'GetPendingAppointments',
    'GetUnpaidReceipts',
    'GetActiveLabOrders',
    'SearchShop',
    'RecommendEquipment',
    'SearchCourses',
    'RecommendCourses',
  ].includes(action.type);
}

export function isCreationAction(action: AIAction): boolean {
  return ['CreateAppointment', 'UpdateAppointmentStatus', 'CreatePatient', 'CreateLabOrder', 'GenerateDailyReport'].includes(action.type);
}