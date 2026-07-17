import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { queryKeys } from './keys'

export function useCourses(params?: Record<string, string>) {
  return useQuery({
    queryKey: [...queryKeys.courses, params],
    queryFn: () => apiClient.getSchoolCourses(params),
  })
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: queryKeys.course(id),
    queryFn: () => apiClient.getSchoolCourse(id),
    enabled: !!id,
  })
}

export function useEnrollCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => apiClient.enrollCourse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses })
    },
  })
}
