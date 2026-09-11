import { apiRequest } from './api'

export type AIEmployeeTaskState =
  | 'queued'
  | 'observing'
  | 'proposed'
  | 'awaiting_approval'
  | 'executing'
  | 'verified'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AIEmployeeTaskRecord {
  id: string
  clinicId: string
  userId: string | null
  role: string
  employeeTitle: string
  title: string
  description: string | null
  status: AIEmployeeTaskState
  risk: 'low' | 'medium' | 'high' | 'critical'
  autonomy: string
  sourceEventId: string | null
  sourceEventType: string | null
  action: string | null
  actionPayload: unknown
  result: unknown
  error: string | null
  dueAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export async function getAIEmployeeTasks(limit = 20): Promise<AIEmployeeTaskRecord[]> {
  const response = await apiRequest(`/api/ai/approvals/tasks?limit=${Math.min(Math.max(limit, 1), 50)}`)
  // apiRequest unwraps the standard { ok, data } envelope and returns data directly.
  return Array.isArray(response) ? response : []
}

export async function transitionAIEmployeeTask(
  id: string,
  status: AIEmployeeTaskState,
  result?: unknown,
): Promise<AIEmployeeTaskRecord | null> {
  const response = await apiRequest(`/api/ai/approvals/tasks/${encodeURIComponent(id)}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, result }),
  })
  // apiRequest unwraps { ok, data } so the task itself is the return value.
  return response && typeof response === 'object' ? response as AIEmployeeTaskRecord : null
}
