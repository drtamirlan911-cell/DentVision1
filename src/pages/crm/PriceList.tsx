import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { DollarSign, Download, Edit, RotateCcw, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'
import { Button } from '../../components/ui/ds/Button'
import { Card } from '../../components/ui/ds/Card'
import { Input, Select } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard'
import { tg, ALL_SERVICES } from '../../utils/constants'
import { cn } from '../../lib/utils'
import type { Clinic, User, RoleInfo } from '../../types'

type ServiceRow = {
  id: string
  cat: string
  name: string
  price: number
  custom?: boolean
}

const BASE_CATEGORIES = [...new Set(ALL_SERVICES.map(s => s.cat))]
const CUSTOM_CAT = 'Свои услуги'

function parseCustomName(raw?: string | null): { cat: string; name: string } {
  if (!raw) return { cat: CUSTOM_CAT, name: 'Услуга' }
  const sep = raw.indexOf(' · ')
  if (sep > 0) {
    return { cat: raw.slice(0, sep) || CUSTOM_CAT, name: raw.slice(sep + 3) || raw }
  }
  return { cat: CUSTOM_CAT, name: raw }
}

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export default function PriceList() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const { showToast } = useToast()
  const [clinicPrices, setClinicPrices] = useState<Record<string, number>>({})
  const [customServices, setCustomServices] = useState<ServiceRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceRow | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [newService, setNewService] = useState({ name: '', cat: BASE_CATEGORIES[0] || CUSTOM_CAT, price: 0, matCost: 0 })
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    try {
      const rows = await api.getPriceList()
      const map: Record<string, number> = {}
      const customs: ServiceRow[] = []
      for (const r of rows || []) {
        if (!r.serviceCode) continue
        map[r.serviceCode] = Number(r.price)
        const isBase = ALL_SERVICES.some(s => s.id === r.serviceCode)
        if (!isBase) {
          const parsed = parseCustomName(r.name)
          customs.push({
            id: r.serviceCode,
            cat: parsed.cat,
            name: parsed.name,
            price: Number(r.price),
            custom: true,
          })
        }
      }
      setClinicPrices(map)
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
    () => [...new Set([...BASE_CATEGORIES, ...customServices.map(s => s.cat)])],
    [customServices],
  )

  const getServicePrice = (serviceId: string, basePrice?: number): number => {
    const custom = clinicPrices[serviceId]
    if (custom !== undefined) return custom
    const base = ALL_SERVICES.find(s => s.id === serviceId)
    return base?.price ?? basePrice ?? 0
  }

  const handleSavePrice = async (serviceId: string, newPrice: number, name?: string) => {
    setClinicPrices(prev => ({ ...prev, [serviceId]: Number(newPrice) }))
    try {
      await api.upsertPriceListItem({ serviceCode: serviceId, price: Number(newPrice), name })
    } catch {
      showToast('Не удалось сохранить на сервер', 'warning')
    }
  }

  const filteredServices = selectedCategory === 'all'
    ? allServices
    : allServices.filter(s => s.cat === selectedCategory)

  const openEdit = (service: ServiceRow) => {
    setEditingService({ ...service, price: getServicePrice(service.id, service.price) })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editingService || editingService.price <= 0) {
      showToast('Введите корректную цену', 'warning')
      return
    }
    const storedName = editingService.custom
      ? `${editingService.cat} · ${editingService.name}`
      : editingService.name
    await handleSavePrice(editingService.id, editingService.price, storedName)
    showToast(`Цена на "${editingService.name}" обновлена`, 'success')
    setModalOpen(false)
    setEditingService(null)
  }

  const handleReset = async (serviceId: string) => {
    setClinicPrices(prev => { const next = { ...prev }; delete next[serviceId]; return next })
    const base = ALL_SERVICES.find(s => s.id === serviceId)
    if (base) {
      try { await api.upsertPriceListItem({ serviceCode: serviceId, price: base.price, name: base.name }) } catch { /* ignore */ }
    }
    showToast('Цена сброшена к стандартной', 'success')
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
      const row =       await api.addPriceListService({
        name: newService.name.trim(),
        price: Number(newService.price),
        category: newService.cat || CUSTOM_CAT,
        matCost: Number(newService.matCost || 0),
      })
      showToast(`Услуга «${newService.name.trim()}» добавлена`, 'success')
      setAddOpen(false)
      setNewService({ name: '', cat: BASE_CATEGORIES[0] || CUSTOM_CAT, price: 0, matCost: 0 })
      if (row?.serviceCode) {
        setClinicPrices(prev => ({ ...prev, [row.serviceCode]: Number(row.price) }))
        const parsed = parseCustomName(row.name)
        setCustomServices(prev => [
          ...prev,
          { id: row.serviceCode, cat: parsed.cat, name: parsed.name, price: Number(row.price), custom: true },
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
    ...BASE_CATEGORIES.map(c => ({ value: c, label: c })),
    { value: CUSTOM_CAT, label: CUSTOM_CAT },
  ]

  return (
    <div className="dv-page py-4 md:py-6">
      <PageHeader
        title="Прайс-лист"
        subtitle={`${clinic?.name} · Индивидуальные цены для клиники`}
        icon={<DollarSign size={20} />}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
              Добавить услугу
            </Button>
            <Button variant="secondary" icon={<Download size={16} />}
              onClick={() => showToast('Прайс экспортирован в Excel', 'success')}>
              Экспорт
            </Button>
          </div>
        }
      />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <Button variant={selectedCategory === 'all' ? 'outline' : 'ghost'} size="sm"
          onClick={() => setSelectedCategory('all')}
          className={selectedCategory === 'all' ? 'border-dv-gold/50 text-dv-gold' : ''}>
          Все услуги
        </Button>
        {categories.map(cat => (
          <Button key={cat} variant={selectedCategory === cat ? 'outline' : 'ghost'} size="sm"
            onClick={() => setSelectedCategory(cat)}
            className={selectedCategory === cat ? 'border-dv-gold/50 text-dv-gold' : ''}>
            {cat}
          </Button>
        ))}
      </div>

      <Card padding="none" className="overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-bdr-subtle">
                {['Услуга', 'Категория', 'Базовая цена', 'Цена клиники', 'Действия'].map(h => (
                  <th key={h} className={cn(
                    'py-3 px-4 text-2xs font-bold text-txt-muted uppercase tracking-wider',
                    h === 'Базовая цена' || h === 'Цена клиники' || h === 'Действия' ? 'text-right' : 'text-left'
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service, idx) => {
                const basePrice = service.custom ? service.price : service.price
                const clinicPrice = getServicePrice(service.id, service.price)
                const isCustomPrice = !service.custom && clinicPrice !== basePrice
                return (
                  <tr key={service.id} className={cn('border-b border-bdr-subtle last:border-b-0', idx % 2 !== 0 && 'bg-white/[0.01]')}>
                    <td className="py-3 px-4 text-sm font-semibold text-txt-primary">
                      {service.name}
                      {service.custom && <Badge variant="gold" size="sm" className="ml-2">своя</Badge>}
                    </td>
                    <td className="py-3 px-4"><Badge variant="info" size="sm">{service.cat}</Badge></td>
                    <td className="py-3 px-4 text-right text-sm text-txt-secondary">
                      {service.custom ? '—' : tg(basePrice)}
                    </td>
                    <td className={cn('py-3 px-4 text-right text-sm font-bold', isCustomPrice || service.custom ? 'text-dv-gold' : 'text-success')}>
                      {tg(clinicPrice)}
                      {isCustomPrice && <span className="ml-1 text-warning">*</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon-sm" icon={<Edit size={14} />} onClick={() => openEdit(service)} />
                        {isCustomPrice && (
                          <Button variant="ghost" size="icon-sm" icon={<RotateCcw size={14} />}
                            onClick={() => handleReset(service.id)} className="text-error/60 hover:text-error" />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Изменённых цен" value={Object.keys(clinicPrices).filter(id => ALL_SERVICES.some(s => s.id === id && clinicPrices[id] !== s.price)).length} icon={<DollarSign size={18} />} />
        <StatCard label="Своих услуг" value={customServices.length} icon={<Plus size={18} />} />
        <StatCard label="Всего услуг" value={allServices.length} icon={<DollarSign size={18} />} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? `Редактировать цену: ${editingService.name}` : 'Редактировать цену'}
        size="md"
      >
        {editingService && (
          <div className="space-y-4">
            <Input
              label="Цена для клиники (₸)"
              type="number"
              value={editingService.price}
              onChange={e => setEditingService({ ...editingService, price: Number(e.target.value) })}
              autoFocus
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1">Сохранить</Button>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Добавить услугу в прайс"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Название *"
            value={newService.name}
            onChange={e => setNewService({ ...newService, name: e.target.value })}
            placeholder="Профгигиена AirFlow"
            autoFocus
          />
          <Select
            label="Категория"
            value={newService.cat}
            onChange={e => setNewService({ ...newService, cat: e.target.value })}
            options={categoryOptions}
          />
          <Input
            label="Цена (₸) *"
            type="number"
            value={newService.price || ''}
            onChange={e => setNewService({ ...newService, price: Number(e.target.value) })}
            placeholder="15000"
          />
          <Input
            label="Себестоимость материалов (₸)"
            type="number"
            value={newService.matCost || ''}
            onChange={e => setNewService({ ...newService, matCost: Number(e.target.value) })}
            placeholder="2000"
          />
          <p className="text-2xs text-txt-muted -mt-2">Учитывается в зарплате врача: (цена − материалы) × %</p>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddService} disabled={saving} className="flex-1">
              {saving ? 'Сохранение…' : 'Добавить'}
            </Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Отмена</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
