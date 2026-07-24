import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

export function useProducts(params?: Record<string, string>) {
  return useQuery({
    queryKey: [...queryKeys.products, params],
    queryFn: () => api.getShopProducts(params),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.getShopProduct(id),
    enabled: !!id,
  })
}

export function useOrders(clinicId: string) {
  return useQuery({
    queryKey: [...queryKeys.products, 'orders'],
    queryFn: () => api.getShopOrders(clinicId),
    enabled: !!clinicId,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.createShopOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}
