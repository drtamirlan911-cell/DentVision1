import { describe, expect, it } from 'vitest'
import { ALL_SERVICES, SERVICE_CATEGORIES, findService, servicesForDiagnosis } from './service-catalog'
import { mergePriceList, snapDuration, parseCustomServiceName } from './clinicPrices'

/**
 * Идентификаторы услуг вечные: на них ссылаются строки прайса клиник, чеки
 * и планы лечения в базе. Эти цифры и названия — то, что уже лежит у клиник,
 * поэтому они зафиксированы здесь дословно.
 */
const LEGACY: Array<[string, string, number]> = [
  ['s1', 'Первичная консультация', 3000],
  ['s3', 'Лечение кариеса (1 поверхность)', 15000],
  ['s8', 'Лечение пульпита (3 канала)', 50000],
  ['s13', 'Профгигиена полости рта', 18000],
  ['s14', 'Отбеливание (кабинетное)', 45000],
  ['s20', 'Установка брекет-системы (1 челюсть)', 150000],
  ['s23', 'Установка импланта (без коронки)', 200000],
  ['s28', 'Временная коронка', 8000],
]

describe('справочник услуг', () => {
  it('не содержит повторяющихся идентификаторов', () => {
    const ids = ALL_SERVICES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('сохраняет исходные 28 позиций', () => {
    for (let i = 1; i <= 28; i += 1) {
      expect(findService(`s${i}`), `услуга s${i} пропала из справочника`).toBeDefined()
    }
  })

  it('не меняет цены и названия исходных позиций', () => {
    for (const [id, name, price] of LEGACY) {
      const s = findService(id)!
      expect(s.name, `название ${id}`).toBe(name)
      expect(s.price, `цена ${id}`).toBe(price)
    }
  })

  it('у каждой позиции есть категория из общего списка', () => {
    for (const s of ALL_SERVICES) {
      expect(SERVICE_CATEGORIES).toContain(s.cat)
    }
  })

  it('у платной услуги материалы не дороже цены', () => {
    // Бесплатные позиции исключены намеренно: осмотр по гарантии стоит 0 по
    // замыслу, но перчатки на нём всё равно расходуются.
    const broken = ALL_SERVICES.filter((s) => s.price > 0 && (s.matCost ?? 0) > s.price)
    expect(broken.map((s) => s.id)).toEqual([])
  })
})

describe('servicesForDiagnosis', () => {
  it('находит услуги по точному коду', () => {
    const ids = servicesForDiagnosis('K02.1').map((s) => s.id)
    expect(ids).toContain('s3')
  })

  it('раскрывает рубрику: код без уточнения ловит всю группу', () => {
    // Врач ставит диагноз с той точностью, с какой хочет; правило на K02.1
    // не должно молчать на приёме, закрытом с K02.9.
    const ids = servicesForDiagnosis('K02.9').map((s) => s.id)
    expect(ids).toContain('s3')
  })

  it('молчит на пустом и неизвестном коде', () => {
    expect(servicesForDiagnosis('')).toEqual([])
    expect(servicesForDiagnosis('Z99.9')).toEqual([])
  })
})

describe('mergePriceList', () => {
  it('накладывает цену клиники поверх справочной', () => {
    const merged = mergePriceList([{ serviceCode: 's3', price: 19000, matCost: 4000 }])
    const s3 = merged.find((s) => s.id === 's3')!
    expect(s3.clinicPrice).toBe(19000)
    expect(s3.clinicMatCost).toBe(4000)
    // Справочная цена остаётся видимой — из неё считается «сброс к базовой».
    expect(s3.price).toBe(15000)
  })

  it('оставляет справочные значения там, где клиника ничего не правила', () => {
    const s6 = mergePriceList([])!.find((s) => s.id === 's6')!
    expect(s6.clinicPrice).toBe(s6.price)
    expect(s6.clinicMatCost).toBe(s6.matCost)
  })

  it('добавляет свои услуги клиники и разбирает их категорию', () => {
    const merged = mergePriceList([{ serviceCode: 'custom_x', name: 'Терапия · Своя услуга', price: 5000 }])
    const own = merged.find((s) => s.id === 'custom_x')!
    expect(own).toMatchObject({ cat: 'Терапия', name: 'Своя услуга', clinicPrice: 5000, custom: true })
  })

  it('переживает пустой прайс', () => {
    expect(mergePriceList(null)).toHaveLength(ALL_SERVICES.length)
  })
})

describe('parseCustomServiceName', () => {
  it('делит на категорию и название', () => {
    expect(parseCustomServiceName('Гигиена · AirFlow')).toEqual({ cat: 'Гигиена', name: 'AirFlow' })
  })

  it('кладёт название без разделителя в «Свои услуги»', () => {
    expect(parseCustomServiceName('AirFlow')).toEqual({ cat: 'Свои услуги', name: 'AirFlow' })
  })
})

describe('snapDuration', () => {
  it('подбирает ближайший шаг из тех, что предлагает форма', () => {
    expect(snapDuration(75)).toBe(90)
    expect(snapDuration(70)).toBe(60)
    expect(snapDuration(130)).toBe(120)
  })

  it('не уходит ниже минимального шага', () => {
    expect(snapDuration(5)).toBe(30)
  })

  it('не подставляет ничего, когда длительность неизвестна', () => {
    expect(snapDuration(undefined)).toBeUndefined()
    expect(snapDuration(0)).toBeUndefined()
  })
})
