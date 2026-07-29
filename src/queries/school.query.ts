import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function useCourses(params?: Record<string, string>) {
  return useQuery({
    queryKey: [...queryKeys.courses, params],
    queryFn: () => api.getSchoolCourses(params),
  })
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: queryKeys.course(id),
    queryFn: () => api.getSchoolCourse(id),
    enabled: !!id,
  })
}

export function useEnrollCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.enrollCourse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses })
    },
  })
}
