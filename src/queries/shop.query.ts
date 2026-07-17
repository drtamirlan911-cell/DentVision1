import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { queryKeys } from './keys'

export function useProducts(params?: Record<string, string>) {
  return useQuery({
    queryKey: [...queryKeys.products, params],
    queryFn: () => apiClient.getShopProducts(params),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => apiClient.getShopProduct(id),
    enabled: !!id,
  })
}

export function useOrders(clinicId: string) {
  return useQuery({
    queryKey: [...queryKeys.products, 'orders'],
    queryFn: () => apiClient.getShopOrders(clinicId),
    enabled: !!clinicId,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => apiClient.createShopOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}
