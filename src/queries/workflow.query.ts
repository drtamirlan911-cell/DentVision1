import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.workflows,
    queryFn: () => api.listWorkflows(),
  })
}

export function useWorkflowRuns(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workflowRuns(id || ''),
    queryFn: () => api.listWorkflowRuns(id as string),
    enabled: !!id,
  })
}

export function useCreateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; trigger: api.WorkflowTrigger; graph: api.WorkflowGraph; status?: 'draft' | 'active' }) =>
      api.createWorkflow(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workflows }),
  })
}

export function useUpdateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{ name: string; trigger: api.WorkflowTrigger; graph: api.WorkflowGraph; status: 'draft' | 'active' }>) =>
      api.updateWorkflow(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workflows }),
  })
}

export function useRunWorkflow(id: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.runWorkflow(id as string),
    onSuccess: () => {
      if (id) qc.invalidateQueries({ queryKey: queryKeys.workflowRuns(id) })
    },
  })
}
