import { useQuery } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function useAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => api.getReceipts(''),
  })
}
