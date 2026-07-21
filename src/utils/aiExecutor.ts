import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { aiAction } from '@/utils/api';
import { useAuth } from '@/store/auth.store';
import type { Message } from '@/store/workspace.store';

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
  OpenSchedule: '/crm/schedule',
  OpenPatients: '/crm/patients',
  OpenPatient: '/crm/patients',
  OpenMedicalCard: '/crm/medical-card',
  OpenCashier: '/crm/finance',
  OpenFinance: '/crm/finance',
  OpenLab: '/crm/lab',
  OpenInventory: '/crm/inventory',
  OpenStaff: '/crm/staff',
  OpenVisits: '/crm/visits',
  OpenDocuments: '/crm/documents',
  OpenReminders: '/crm/reminders',
  OpenDentalChart: '/crm/dental-chart',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenPriceList: '/crm/pricelist',
  OpenPromotions: '/crm/promotions',
  OpenShop: '/shop',
  OpenSchool: '/school',
  OpenAnalytics: '/analytics',
  OpenProfile: '/profile',
  OpenSettings: '/settings',
  OpenMyClinics: '/my-clinics',
  OpenDemo: '/demo',
  OpenPricing: '/pricing',
  OpenJobs: '/jobs',
  OpenCommunity: '/community',
};

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
  return NAVIGATION_ACTIONS[action.type] || null;
}

export function isNavigationAction(action: AIAction): boolean {
  return action.type in NAVIGATION_ACTIONS;
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