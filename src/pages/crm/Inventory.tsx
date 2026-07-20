import React, { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Plus, Search, Minus, AlertTriangle, Edit, DollarSign, ShoppingCart } from 'lucide-react'
import { useToast } from '@/components/ui/ds/Toast'
import { useNavigate } from 'react-router-dom'
import { useDataQuery } from '../../queries/useDataQuery'
import { Button } from '../../components/ui/ds/Button'
import { Card } from '../../components/ui/ds/Card'
import { Input, Select } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard'
import { gid, today, INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../../utils/constants'
import { cn, formatMoney } from '../../lib/utils'
import type { InventoryItem, Clinic, User as UserType, RoleInfo } from '../../types'

const EMPTY_FORM = {
  name: '', quantity: 0, unit: 'шт', minQuantity: 0,
  category: '', supplier: '', cost: 0, expiryDate: '',
}

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

interface OutletContext {
  clinic: Clinic & { id: string; name: string }
  user: UserType
  roleInfo?: RoleInfo
}

interface InventoryForm {
  name: string
  quantity: number | string
  unit: string
  minQuantity: number | string
  category: string
  supplier: string
  cost: number | string
  expiryDate: string
}

export default function Inventory() {
  const { clinic } = useOutletContext<OutletContext>()
  const navigate = useNavigate()
  const { showToast, toast, clearToast } = useToast()
  const { inventory, upsertInventoryItem } = useDataQuery(clinic?.id)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<InventoryForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')

  const stats = useMemo(() => ({
    total: inventory.length,
    lowStock: inventory.filter(i => i.quantity <= (i.minQuantity || i.min || 0) && (i.minQuantity || i.min || 0) > 0).length,
    totalValue: inventory.reduce((sum, i) => sum + ((i.cost || 0) * (i.quantity || 0)), 0),
  }), [inventory])

  const filtered = useMemo(() => {
    let items = [...inventory]
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q)
      )
    }
    if (filter === 'lowStock') {
      items = items.filter(i => i.quantity <= (i.minQuantity || i.min || 0) && (i.minQuantity || i.min || 0) > 0)
    }
    if (filter === 'expiring') {
      const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      items = items.filter(i => i.expiryDate && i.expiryDate <= weekFromNow)
    }
    items.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'quantity') return (a.quantity || 0) - (b.quantity || 0)
      if (sortBy === 'cost') return ((b.cost || 0) * (b.quantity || 0)) - ((a.cost || 0) * (a.quantity || 0))
      return 0
    })
    return items
  }, [inventory, search, filter, sortBy])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name.trim()) { showToast('Введите название', 'warning'); return }
    upsertInventoryItem({
      ...form,
      id: editing?.id || gid(),
      clinicId: clinic?.id,
      quantity: Number(form.quantity) || 0,
      minQuantity: Number(form.minQuantity) || 0,
      cost: Number(form.cost) || 0,
    } as any)
    showToast(editing ? 'Товар обновлён' : 'Товар добавлен', 'success')
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditing(null)
  }

  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setForm({
      name: item.name || '', quantity: item.quantity || 0, unit: item.unit || 'шт',
      minQuantity: item.minQuantity || item.min || 0, category: item.category || '',
      supplier: item.supplier || '', cost: item.cost || 0, expiryDate: item.expiryDate || '',
    })
    setModalOpen(true)
  }

  const quickAdjust = (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, (item.quantity || 0) + delta)
    upsertInventoryItem({ ...item, quantity: newQty, clinicId: clinic?.id })
  }

  const getStockVariant = (item: InventoryItem) => {
    const min = item.minQuantity || item.min || 0
    if (min > 0 && item.quantity <= min) return 'error'
    if (min > 0 && item.quantity <= min * 1.5) return 'warning'
    return 'success'
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Склад"
        subtitle={`${clinic?.name} · ${stats.total} позиций`}
        icon={<Package size={20} />}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }}>
            Добавить товар
          </Button>
        }
      />

      <motion.div
        className="grid grid-cols-3 gap-3 mb-5"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <StatCard label="Всего позиций" value={stats.total} icon={<Package size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Мало на складе" value={stats.lowStock} icon={<AlertTriangle size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Общая стоимость" value={`${(stats.totalValue / 1000).toFixed(0)}K ₸`} icon={<DollarSign size={18} />} />
        </motion.div>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." icon={<Search size={16} />} />
        </div>
        {[
          { key: 'all', label: 'Все' },
          { key: 'lowStock', label: 'Мало' },
          { key: 'expiring', label: 'Истекает' },
        ].map(f => (
          <Button key={f.key} variant={filter === f.key ? 'outline' : 'ghost'} size="sm"
            onClick={() => setFilter(f.key)}
            className={filter === f.key ? 'border-dv-gold/50 text-dv-gold' : ''}>
            {f.label}
          </Button>
        ))}
        <Select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          options={[
            { value: 'name', label: 'По названию' },
            { value: 'quantity', label: 'По количеству' },
            { value: 'cost', label: 'По стоимости' },
          ]}
          className="w-auto"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Package size={32} />} title="Склад пуст" description="Добавьте первый товар" />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {filtered.map(item => {
            const min = item.minQuantity || item.min || 0
            const isLow = min > 0 && item.quantity <= min
            const stockVariant = getStockVariant(item)
            return (
              <motion.div key={item.id} variants={fadeUp}>
                <Card hover padding="none" className="overflow-hidden cursor-pointer group" onClick={() => openEdit(item)}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-txt-primary group-hover:text-dv-gold transition-colors truncate">{item.name}</p>
                        {item.category && <Badge variant="info" size="sm" className="mt-1">{item.category}</Badge>}
                      </div>
                      {isLow && <Badge variant="error" size="xs">МАЛО</Badge>}
                    </div>

                    <div className="mb-2.5">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-txt-muted">Остаток</span>
                        <span className={cn('font-bold', stockVariant === 'error' ? 'text-error' : stockVariant === 'warning' ? 'text-warning' : 'text-success')}>
                          {item.quantity} {item.unit || 'шт'}
                        </span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all',
                          stockVariant === 'error' ? 'bg-error' : stockVariant === 'warning' ? 'bg-warning' : 'bg-success'
                        )} style={{ width: `${min > 0 ? Math.min(100, (item.quantity / (min * 2)) * 100) : 50}%` }} />
                      </div>
                      {min > 0 && <p className="text-2xs text-txt-muted mt-0.5">Мин: {min} {item.unit || 'шт'}</p>}
                    </div>

                    <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                      <Button variant="danger" size="icon-xs" icon={<Minus size={12} />} onClick={() => quickAdjust(item, -1)} />
                      <Button variant="primary" size="icon-xs" icon={<Plus size={12} />} onClick={() => quickAdjust(item, 1)} />
                      <Button variant="primary" size="icon-xs" onClick={() => quickAdjust(item, 10)}>+10</Button>
                      {isLow && (
                        <Button
                          variant="secondary"
                          size="icon-xs"
                          title="Заказать в Маркетплейсе"
                          icon={<ShoppingCart size={12} />}
                          onClick={() => navigate(`/shop?q=${encodeURIComponent(item.name || '')}`)}
                        />
                      )}
                    </div>

                    {item.supplier && <p className="text-xs text-txt-muted mt-2">Поставщик: {item.supplier}</p>}
                    {item.expiryDate && (
                      <p className={cn('text-xs mt-0.5', new Date(item.expiryDate) < new Date() ? 'text-error' : 'text-txt-muted')}>
                        Годен до: {item.expiryDate}
                      </p>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Редактировать товар' : 'Добавить товар'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Название *" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Пломбировочный материал" required icon={<Package size={16} />} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Кол-во" type="number" min="0" value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <Select label="Ед. изм." value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              options={INVENTORY_UNITS} />
            <Input label="Мин. кол-во" type="number" min="0" value={form.minQuantity}
              onChange={e => setForm({ ...form, minQuantity: e.target.value })} />
          </div>
          <Select label="Категория" value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            options={[{ value: '', label: '--- Без категории ---' }, ...INVENTORY_CATEGORIES.map(c => ({ value: c, label: c }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Цена за ед. (₸)" type="number" min="0" value={form.cost}
              onChange={e => setForm({ ...form, cost: e.target.value })} />
            <Input label="Годен до" type="date" value={form.expiryDate}
              onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
          </div>
          <Input label="Поставщик" value={form.supplier}
            onChange={e => setForm({ ...form, supplier: e.target.value })}
            placeholder="Название компании" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">{editing ? 'Сохранить' : 'Добавить'}</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
