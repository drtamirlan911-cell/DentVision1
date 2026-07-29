import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Types ───

export interface TimelineEvent {
  id: string
  type: string
  source: string
  timestamp: string
  clinicId: string
  userId?: string
  payload?: Record<string, unknown>
  status: string
  result?: Record<string, unknown>
  error?: string
  durationMs?: number
  processedAt: string
}

export interface TimelineEntry {
  id: string
  event: TimelineEvent
  rules: Array<{
    id: string
    name: string
    event: string
    priority: string
  }>
  results: Array<{
    action: string
    agent: string
    success: boolean
    message?: string
    timelineEntry?: { action: string; result: string }
  }>
  durationMs: number
  processedAt: string
}

export interface TimelineStats {
  totalEvents: number
  todayEvents: number
  successEvents: number
  failedEvents: number
  successRate: number
}

interface TimelineResponse {
  entries: TimelineEntry[]
  total: number
  limit: number
  offset: number
}

const API_URL: string =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname.includes('vercel.app')
    ? 'https://dentvision-api.onrender.com'
    : 'http://localhost:3001')

function getAccessToken(): string | null {
  try {
    return localStorage.getItem('dv_access_token')
  } catch {
    return null
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = getAccessToken()
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return data.data || data
}

// ─── Hooks ───

export function useAITimeline(options?: {
  clinicId?: string
  limit?: number
  offset?: number
  eventType?: string
}) {
  return useQuery<TimelineResponse>({
    queryKey: ['ai', 'timeline', options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.clinicId) params.set('clinicId', options.clinicId)
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.offset) params.set('offset', String(options.offset))
      if (options?.eventType) params.set('eventType', options.eventType)

      return apiFetch<TimelineResponse>(`/ai/timeline?${params.toString()}`)
    },
    refetchInterval: 30_000,
  })
}

export function useAITimelineStats(clinicId?: string) {
  return useQuery<TimelineStats>({
    queryKey: ['ai', 'timeline', 'stats', clinicId],
    queryFn: async () => {
      const params = clinicId ? `?clinicId=${clinicId}` : ''
      return apiFetch<TimelineStats>(`/ai/timeline/stats${params}`)
    },
    refetchInterval: 60_000,
  })
}

export function useRefreshTimeline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai', 'timeline'] })
    },
  })
}
