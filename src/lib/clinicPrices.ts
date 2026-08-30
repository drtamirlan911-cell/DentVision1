/**
 * Прайс клиники = справочник услуг + её собственные правки поверх.
 *
 * `PriceListItem` в базе хранит только отклонения, поэтому любой экран, который
 * показывает цену, обязан их наложить. Расписание этого не делало и всегда
 * рисовало справочную цену: клиника, поднявшая прайс, видела при записи одну
 * сумму, а в чеке — другую.
 */

import { ALL_SERVICES } from './service-catalog'
import type { Service } from '../types'

export interface PriceListRow {
  serviceCode: string
  name?: string | null
  price: number | string
  matCost?: number | string | null
}

export interface PricedService extends Service {
  /** Цена этой клиники: её правка, иначе справочная. */
  clinicPrice: number
  /** Себестоимость материалов этой клиники, иначе справочная. */
  clinicMatCost: number
  /** Услуга заведена самой клиникой, а не взята из справочника. */
  custom: boolean
}

const CUSTOM_CAT = 'Свои услуги'

/** Своя услуга хранится как «Категория · Название» в одном поле `name`. */
export function parseCustomServiceName(raw?: string | null): { cat: string; name: string } {
  if (!raw) return { cat: CUSTOM_CAT, name: 'Услуга' }
  const sep = raw.indexOf(' · ')
  if (sep > 0) return { cat: raw.slice(0, sep) || CUSTOM_CAT, name: raw.slice(sep + 3) || raw }
  return { cat: CUSTOM_CAT, name: raw }
}

export function mergePriceList(rows: PriceListRow[] | null | undefined): PricedService[] {
  const overrides = new Map<string, PriceListRow>()
  for (const row of rows || []) {
    if (row?.serviceCode) overrides.set(String(row.serviceCode), row)
  }

  const merged: PricedService[] = ALL_SERVICES.map((s) => {
    const own = overrides.get(s.id)
    return {
      ...s,
      clinicPrice: own ? Number(own.price) : s.price,
      clinicMatCost: own?.matCost != null ? Number(own.matCost) : (s.matCost ?? 0),
      custom: false,
    }
  })

  // Услуги, которых нет в справочнике, — заведены клиникой вручную.
  const known = new Set(ALL_SERVICES.map((s) => s.id))
  for (const [code, row] of overrides) {
    if (known.has(code)) continue
    const parsed = parseCustomServiceName(row.name)
    merged.push({
      id: code,
      cat: parsed.cat,
      name: parsed.name,
      price: Number(row.price),
      clinicPrice: Number(row.price),
      clinicMatCost: Number(row.matCost || 0),
      custom: true,
    })
  }

  return merged
}

/** Варианты длительности, которые предлагает форма записи. */
const DURATION_STEPS = [30, 45, 60, 90, 120]

/**
 * Ближайшая доступная длительность к типичной для услуги.
 *
 * Справочник знает точное время (например 75 или 130 минут), а форма
 * предлагает пять шагов — подставлять надо ближайший, а не игнорировать.
 */
export function snapDuration(minutes: number | undefined | null): number | undefined {
  const m = Number(minutes)
  if (!Number.isFinite(m) || m <= 0) return undefined
  return DURATION_STEPS.reduce((best, step) =>
    Math.abs(step - m) < Math.abs(best - m) ? step : best,
  )
}
