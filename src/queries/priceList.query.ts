import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { mergePriceList, type PricedService } from '@/lib/clinicPrices'
import { queryKeys } from './keys'

/**
 * Прайс клиники, уже наложенный на справочник услуг.
 *
 * Один источник для всех экранов, которые показывают цену: расписание,
 * план лечения, правила списания. Раньше каждый брал справочную цену и
 * расходился с реальным прайсом клиники.
 */
export function useClinicPriceList(clinicId: string | null | undefined) {
  const query = useQuery({
    queryKey: [...queryKeys.priceList, clinicId ?? ''],
    queryFn: () => api.getPriceList(),
    enabled: !!clinicId,
    staleTime: 5 * 60_000,
  })

  // Мемо обязательно: слияние строит 155 объектов, а результат уходит
  // в useMemo-зависимости вызывающих экранов — новая ссылка на каждый
  // рендер пересчитывала бы у них всё.
  const services: PricedService[] = useMemo(
    () => mergePriceList(query.data as any),
    [query.data],
  )
  return { ...query, services }
}
