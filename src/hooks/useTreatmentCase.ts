import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/utils/api';

export type TreatmentCase = {
  id: string;
  clinicId: string;
  patientId: string;
  title: string;
  description?: string | null;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  chiefComplaint?: string | null;
  diagnosisCodes?: unknown;
  metadata?: unknown;
  patient?: { id: string; firstName: string; lastName: string; phone?: string | null };
  counts?: Record<string, number>;
  graph?: {
    appointments: any[];
    labOrders: any[];
    invoices: any[];
    treatmentPlans: any[];
    referrals: any[];
    visits: any[];
  };
};

export function useTreatmentCase(caseId?: string | null) {
  const queryClient = useQueryClient();
  const key = ['treatment-case', caseId || ''];

  const query = useQuery<TreatmentCase>({
    queryKey: key,
    queryFn: () => apiRequest(`/api/crm/cases/${encodeURIComponent(caseId!)}`),
    enabled: Boolean(caseId),
    staleTime: 30_000,
  });

  const linkMutation = useMutation({
    mutationFn: ({ target, recordId }: { target: string; recordId: string }) =>
      apiRequest(`/api/crm/cases/${encodeURIComponent(caseId!)}/links`, {
        method: 'POST',
        body: JSON.stringify({ target, recordId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ target, recordId }: { target: string; recordId: string }) =>
      apiRequest(`/api/crm/cases/${encodeURIComponent(caseId!)}/links`, {
        method: 'DELETE',
        body: JSON.stringify({ target, recordId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    ...query,
    caseData: query.data || null,
    linkRecord: linkMutation.mutateAsync,
    unlinkRecord: unlinkMutation.mutateAsync,
    isLinking: linkMutation.isPending || unlinkMutation.isPending,
  };
}
