import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { queryKeys } from './keys'
import type { User, LoginResponse } from '@/types'

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ login, password }: { login: string; password: string }) =>
      apiClient.login(login, password),
    onSuccess: (data: LoginResponse) => {
      queryClient.setQueryData(queryKeys.auth, data.user)
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: Partial<User> & { password: string }) =>
      apiClient.register(data),
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (login: string) => apiClient.forgotPassword(login),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      apiClient.resetPassword(token, password),
  })
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.auth,
    queryFn: () => apiClient.getMe(),
  })
}
