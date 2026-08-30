import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { DollarSign, Download, Edit, RotateCcw, Plus, Search, Clock, Percent } from 'lucide-react'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'
import { Button } from '../../components/ui/ds/Button'
import { Card } from '../../components/ui/ds/Card'
import { Input, Select } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard'
import { tg, ALL_SERVICES, SERVICE_CATEGORIES } from '../../utils/constants'
import { cn } from '../../lib/utils'
import { downloadCsv } from '../../lib/financePeriod'
import type { Clinic, User, RoleInfo } from '../../types'

type ServiceRow = {
  id: string
  cat: string
  name: string
  price: number
  durationMin?: number
  matCost?: number
  icd?: string[]
  custom?: boolean
}

const CUSTOM_CAT = 'Свои услуги'

function parseCustomName(raw?: string | null): { cat: string; name: string } {
  if (!raw) return { cat: CUSTOM_CAT, name: 'Услуга' }
  const sep = raw.indexOf(' · ')
  if (sep > 0) {
    return { cat: raw.slice(0, sep) || CUSTOM_CAT, name: raw.slice(sep + 3) || raw }
  }
  return { cat: CUSTOM_CAT, name: raw }
}

/** Маржа в процентах от цены. Ниже этого — строка подсвечивается как убыточная. */
const THIN_MARGIN_PCT = 30

export default function PriceList() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const { showToast } = useToast()
  const [clinicPrices, setClinicPrices] = useState<Record<string, number>>({})
  // Себестоимость клиники хранится отдельно от цены: бэкенд принимал matCost
  // с самого начала, но страница его никогда не читала обратно — клиника
  // задавала материалы один раз и больше их не видела.
  const [clinicMatCosts, setClinicMatCosts] = useState<Record<string, number>>({})
  const [customServices, setCustomServices] = useState<ServiceRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceRow | null>(null)
  const [editMatCost, setEditMatCost] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [newService, setNewService] = useState({ name: '', cat: SERVICE_CATEGORIES[0] || CUSTOM_CAT, price: 0, matCost: 0 })
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    try {
      const rows = await api.getPriceList()
      const prices: Record<string, number> = {}
      const mats: Record<string, number> = {}
      const customs: ServiceRow[] = []
      for (const r of rows || []) {
        if (!r.serviceCode) continue
        prices[r.serviceCode] = Number(r.price)
        if (r.matCost != null) mats[r.serviceCode] = Number(r.matCost)
        const isBase = ALL_SERVICES.some(s => s.id === r.serviceCode)
        if (!isBase) {
          const parsed = parseCustomName(r.name)
          customs.push({
            id: r.serviceCode,
            cat: parsed.cat,
            name: parsed.name,
            price: Number(r.price),
            matCost: Number(r.matCost || 0),
            custom: true,
          })
        }
      }
      setClinicPrices(prices)
      setClinicMatCosts(mats)
      setCustomServices(customs)
    } catch { /* keep defaults */ }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await reload()
    })()
    return () => { cancelled = true }
  }, [clinic?.id])

  const allServices = useMemo<ServiceRow[]>(() => [
    ...ALL_SERVICES.map(s => ({ ...s, custom: false })),
    ...customServices,
  ], [customServices])

  const categories = useMemo(
    () => [...new Set([...SERVICE_CATEGORIES, ...customServices.map(s => s.cat)])],
    [customServices],
  )

  const getServicePrice = (serviceId: string, basePrice?: number): number => {
    const custom = clinicPrices[serviceId]
    if (custom !== undefined) return custom
    const base = ALL_SERVICES.find(s => s.id === serviceId)
    return base?.price ?? basePrice ?? 0
  }

  const getMatCost = (service: ServiceRow): number => {
    const own = clinicMatCosts[service.id]
    if (own !== undefined) return own
    return service.matCost ?? 0
  }

  const handleSavePrice = async (
    serviceId: string,
    newPrice: number,
    name?: string,
    matCost?: number,
  ) => {
    setClinicPrices(prev => ({ ...prev, [serviceId]: Number(newPrice) }))
    if (matCost !== undefined) {
      setClinicMatCosts(prev => ({ ...prev, [serviceId]: Number(matCost) }))
    }
    try {
      await api.upsertPriceListItem({ serviceCode: serviceId, price: Number(newPrice), name, matCost })
    } catch {
      showToast('Не удалось сохранить на сервер', 'warning')
    }
  }

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allServices.filter(s => {
      if (selectedCategory !== 'all' && s.cat !== selectedCategory) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q)
        || s.cat.toLowerCase().includes(q)
        || (s.icd || []).some(c => c.toLowerCase().includes(q))
      )
    })
  }, [allServices, selectedCategory, search])

  const handleExport = () => {
    downloadCsv(
      `pricelist-${clinic?.name || 'clinic'}.csv`,
      ['Категория', 'Услуга', 'Цена, ₸', 'Материалы, ₸', 'Маржа, ₸', 'Минут'],
      filteredServices.map(s => {
        const price = getServicePrice(s.id, s.price)
        const mat = getMatCost(s)
        return [s.cat, s.name, price, mat, price - mat, s.durationMin ?? '']
      }),
    )
  }

  const openEdit = (service: ServiceRow) => {
    setEditingService({ ...service, price: getServicePrice(service.id, service.price) })
    setEditMatCost(getMatCost(service))
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editingService || editingService.price <= 0) {
      showToast('Введите корректную цену', 'warning')
      return
    }
    if (editMatCost > editingService.price) {
      showToast('Материалы дороже самой услуги — проверьте цифры', 'warning')
      return
    }
    const storedName = editingService.custom
      ? `${editingService.cat} · ${editingService.name}`
      : editingService.name
    await handleSavePrice(editingService.id, editingService.price, storedName, editMatCost)
    showToast(`Цена на «${editingService.name}» обновлена`, 'success')
    setModalOpen(false)
    setEditingService(null)
  }

  const handleReset = async (serviceId: string) => {
    const base = ALL_SERVICES.find(s => s.id === serviceId)
    if (!base) return
    setClinicPrices(prev => { const next = { ...prev }; delete next[serviceId]; return next })
    setClinicMatCosts(prev => { const next = { ...prev }; delete next[serviceId]; return next })
    try {
      await api.upsertPriceListItem({
        serviceCode: serviceId,
        price: base.price,
        name: base.name,
        matCost: base.matCost ?? 0,
      })
    } catch { /* ignore */ }
    showToast('Цена сброшена к справочной', 'success')
  }

  const handleAddService = async () => {
    if (!newService.name.trim()) {
      showToast('Укажите название услуги', 'warning')
      return
    }
    if (!newService.price || newService.price <= 0) {
      showToast('Укажите цену', 'warning')
      return
    }
    setSaving(true)
    try {
      const row = await api.addPriceListService({
        name: newService.name.trim(),
        price: Number(newService.price),
        category: newService.cat || CUSTOM_CAT,
        matCost: Number(newService.matCost || 0),
      })
      showToast(`Услуга «${newService.name.trim()}» добавлена`, 'success')
      setAddOpen(false)
      setNewService({ name: '', cat: SERVICE_CATEGORIES[0] || CUSTOM_CAT, price: 0, matCost: 0 })
      if (row?.serviceCode) {
        setClinicPrices(prev => ({ ...prev, [row.serviceCode]: Number(row.price) }))
        setClinicMatCosts(prev => ({ ...prev, [row.serviceCode]: Number(row.matCost || 0) }))
        const parsed = parseCustomName(row.name)
        setCustomServices(prev => [
          ...prev,
          {
            id: row.serviceCode,
            cat: parsed.cat,
            name: parsed.name,
            price: Number(row.price),
            matCost: Number(row.matCost || 0),
            custom: true,
          },
        ])
      } else {
        await reload()
      }
    } catch (err: any) {
      showToast(err?.message || 'Не удалось добавить услугу', 'error')
    } finally {
      setSaving(false)
    }
  }

  const categoryOptions = [
    ...SERVICE_CATEGORIES.map(c => ({ value: c, label: c })),
    { value: CUSTOM_CAT, label: CUSTOM_CAT },
  ]

  const changedCount = useMemo(
    () => ALL_SERVICES.filter(s => {
      const p = clinicPrices[s.id]
      return p !== undefined && p !== s.price
    }).length,
    [clinicPrices],
  )

  /** Средняя маржа по видимому срезу — сразу отвечает «мы вообще зарабатываем?». */
  const avgMarginPct = useMemo(() => {
    const rows = filteredServices
      .map(s => ({ price: getServicePrice(s.id, s.price), mat: getMatCost(s) }))
      .filter(r => r.price > 0)
    if (!rows.length) return 0
    const total = rows.reduce((sum, r) => sum + (r.price - r.mat) / r.price, 0)
    return Math.round((total / rows.length) * 100)
  }, [filteredServices, clinicPrices, clinicMatCosts])

  return (
    <div className="dv-page py-4 md:py-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Прайс-лист"
        subtitle={`${clinic?.name} · ${allServices.length} услуг в справочнике`}
        icon={<DollarSign size={20} />}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)} className="min-h-11">
              Добавить услугу
            </Button>
            <Button variant="secondary" icon={<Download size={16} />}
              onClick={handleExport} className="min-h-11">
              Экспорт
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию, категории или коду МКБ-10"
          icon={<Search size={16} />}
          className="min-h-11"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Button variant={selectedCategory === 'all' ? 'outline' : 'ghost'} size="sm"
          onClick={() => setSelectedCategory('all')}
          className={cn('min-h-11', selectedCategory === 'all' ? 'border-dv-gold/50 text-dv-gold' : '')}>
          Все услуги
        </Button>
        {categories.map(cat => (
          <Button key={cat} variant={selectedCategory === cat ? 'outline' : 'ghost'} size="sm"
            onClick={() => setSelectedCategory(cat)}
            className={cn('min-h-11', selectedCategory === cat ? 'border-dv-gold/50 text-dv-gold' : '')}>
            {cat}
          </Button>
        ))}
      </div>

      <Card padding="none" className="overflow-hidden mb-5">
        {filteredServices.length === 0 ? (
          <EmptyState
            icon={<Search size={28} />}
            title="Ничего не нашлось"
            description="Попробуйте другой запрос или снимите фильтр по категории."
            action={
              <Button variant="secondary" className="min-h-11"
                onClick={() => { setSearch(''); setSelectedCategory('all') }}>
                Сбросить фильтры
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Услуга', 'Категория', 'Справочная', 'Цена клиники', 'Материалы', 'Маржа', ''].map((h, i) => (
                    <th key={h || `col${i}`} className={cn(
                      'py-3 px-4 text-2xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap',
                      i >= 2 ? 'text-right' : 'text-left',
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service, idx) => {
                  const basePrice = service.price
                  const clinicPrice = getServicePrice(service.id, service.price)
                  const matCost = getMatCost(service)
                  const isCustomPrice = !service.custom && clinicPrice !== basePrice
                  const margin = clinicPrice - matCost
                  const marginPct = clinicPrice > 0 ? Math.round((margin / clinicPrice) * 100) : 0
                  const thin = clinicPrice > 0 && marginPct < THIN_MARGIN_PCT
                  return (
                    <tr key={service.id} className={cn('border-b border-bdr-subtle last:border-b-0', idx % 2 !== 0 && 'bg-white/[0.01]')}>
                      <td className="py-3 px-4">
                        <div className="text-sm font-semibold text-txt-primary">
                          {service.name}
                          {service.custom && <Badge variant="gold" size="sm" className="ml-2">своя</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {service.durationMin ? (
                            <span className="inline-flex items-center gap-1 text-2xs text-txt-muted">
                              <Clock size={11} />{service.durationMin} мин
                            </span>
                          ) : null}
                          {(service.icd || []).map(code => (
                            <span key={code} className="text-2xs text-txt-muted font-mono">{code}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4"><Badge variant="info" size="sm">{service.cat}</Badge></td>
                      <td className="py-3 px-4 text-right text-sm text-txt-secondary whitespace-nowrap">
                        {service.custom ? '—' : tg(basePrice)}
                      </td>
                      <td className={cn('py-3 px-4 text-right text-sm font-bold whitespace-nowrap', isCustomPrice || service.custom ? 'text-dv-gold' : 'text-success')}>
                        {tg(clinicPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-txt-secondary whitespace-nowrap">
                        {matCost > 0 ? tg(matCost) : '—'}
                      </td>
                      <td className={cn('py-3 px-4 text-right text-sm whitespace-nowrap', thin ? 'text-warning' : 'text-txt-secondary')}>
                        {clinicPrice > 0 ? `${tg(margin)} · ${marginPct}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon-sm" icon={<Edit size={14} />} onClick={() => openEdit(service)} aria-label={`Изменить цену: ${service.name}`} className="min-h-11 min-w-11" />
                          {isCustomPrice && (
                            <Button variant="ghost" size="icon-sm" icon={<RotateCcw size={14} />}
                              onClick={() => handleReset(service.id)} className="text-error/60 hover:text-error min-h-11 min-w-11" aria-label={`Сбросить цену к справочной: ${service.name}`} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Изменённых цен" value={changedCount} icon={<Edit size={18} />} />
        <StatCard label="Своих услуг" value={customServices.length} icon={<Plus size={18} />} />
        <StatCard label="Всего услуг" value={allServices.length} icon={<DollarSign size={18} />} />
        <StatCard label="Средняя маржа" value={`${avgMarginPct}%`} icon={<Percent size={18} />} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? `Цена: ${editingService.name}` : 'Редактировать цену'}
        size="md"
        className="max-w-full sm:max-w-md"
      >
        {editingService && (
          <div className="space-y-4">
            <Input
              label="Цена для клиники (₸)"
              type="number"
              value={editingService.price}
              onChange={e => setEditingService({ ...editingService, price: Number(e.target.value) })}
              autoFocus
              className="min-h-11"
            />
            <Input
              label="Себестоимость материалов (₸)"
              type="number"
              value={editMatCost || ''}
              onChange={e => setEditMatCost(Number(e.target.value))}
              placeholder="0"
              className="min-h-11"
            />
            <div className="rounded-lg bg-surface-1 border border-bdr-subtle p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-txt-muted">Маржа с услуги</span>
                <span className="font-bold text-txt-primary">
                  {tg(editingService.price - editMatCost)}
                  {editingService.price > 0 && (
                    <span className="text-txt-muted font-normal">
                      {' · '}{Math.round(((editingService.price - editMatCost) / editingService.price) * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <p className="text-2xs text-txt-muted mt-2">
                Из неё считается зарплата врача: (цена − материалы) × процент.
              </p>
            </div>
            {!editingService.custom && (
              <p className="text-2xs text-txt-muted">
                Справочная цена — {tg(ALL_SERVICES.find(s => s.id === editingService.id)?.price ?? 0)}.
                Ваша цена сохраняется только для этой клиники.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1 min-h-11">Сохранить</Button>
              <Button variant="ghost" onClick={() => setModalOpen(false)} className="min-h-11">Отмена</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Добавить услугу в прайс"
        size="md"
        className="max-w-full sm:max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="Название *"
            value={newService.name}
            onChange={e => setNewService({ ...newService, name: e.target.value })}
            placeholder="Профгигиена AirFlow"
            autoFocus
            className="min-h-11"
          />
          <Select
            label="Категория"
            value={newService.cat}
            onChange={e => setNewService({ ...newService, cat: e.target.value })}
            options={categoryOptions}
            className="min-h-11"
          />
          <Input
            label="Цена (₸) *"
            type="number"
            value={newService.price || ''}
            onChange={e => setNewService({ ...newService, price: Number(e.target.value) })}
            placeholder="15000"
            className="min-h-11"
          />
          <Input
            label="Себестоимость материалов (₸)"
            type="number"
            value={newService.matCost || ''}
            onChange={e => setNewService({ ...newService, matCost: Number(e.target.value) })}
            placeholder="2000"
            className="min-h-11"
          />
          <p className="text-2xs text-txt-muted -mt-2">Учитывается в зарплате врача: (цена − материалы) × %</p>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddService} disabled={saving} className="flex-1 min-h-11">
              {saving ? 'Сохранение…' : 'Добавить'}
            </Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="min-h-11">Отмена</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
