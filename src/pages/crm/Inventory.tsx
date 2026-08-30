import React, { useState, useMemo, useEffect } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Plus, Search, Minus, AlertTriangle, Edit, DollarSign, ShoppingCart, History, PackageMinus } from 'lucide-react'
import { useToast } from '@/components/ui/ds/Toast'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useDataQuery } from '../../queries/useDataQuery'
import { queryKeys } from '../../queries/keys'
import * as api from '../../utils/api'
import { InventoryItemPicker } from '../../components/crm/InventoryItemPicker'
import { Button } from '../../components/ui/ds/Button'
import { Card } from '../../components/ui/ds/Card'
import { Input, Select } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard'
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../../utils/constants'
import { cn, formatMoney } from '../../lib/utils'
import { buildClinicRestockSuggestions, findShopMatches } from '@/lib/inventory-shop-match'
import type { InventoryItem, Clinic, User as UserType, RoleInfo } from '../../types'

const EMPTY_FORM = {
  name: '', quantity: 0, unit: 'шт', minQuantity: 0,
  category: '', supplier: '', cost: 0, expiryDate: '',
  sku: '', productId: '', autoRestock: true,
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
  /** Артикул и товар маркета — заполняются выбором подсказки. */
  sku: string
  productId: string
  /** Принимать ли автоприход из доставленных заказов. */
  autoRestock: boolean
}

export default function Inventory() {
  const { clinic } = useOutletContext<OutletContext>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast, toast, clearToast } = useToast()
  const { inventory, upsertInventoryItem } = useDataQuery(clinic?.id)
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<InventoryForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState(() => searchParams.get('filter') || 'all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [shopProducts, setShopProducts] = useState<any[]>([])
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<api.InventoryMovementRow[] | null>(null)

  useEffect(() => {
    const f = searchParams.get('filter')
    if (f) setFilter(f)
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    api.getShopProducts()
      .then((rows) => { if (!cancelled) setShopProducts(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (!cancelled) setShopProducts([]) })
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => ({
    total: inventory.length,
    lowStock: inventory.filter(i => i.quantity <= (i.minQuantity || i.min || 0) && (i.minQuantity || i.min || 0) > 0).length,
    totalValue: inventory.reduce((sum, i) => sum + ((i.cost || 0) * (i.quantity || 0)), 0),
  }), [inventory])

  const restockSuggestions = useMemo(
    () => buildClinicRestockSuggestions(inventory, shopProducts, { onlyWithMatches: true, limit: 6 }),
    [inventory, shopProducts],
  )

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    if (!form.name.trim()) { showToast('Введите название', 'warning'); return }
    setSubmitting(true)
    try {
      // Идентификатор ставим только при правке. Раньше здесь всегда
      // подставлялся свежий gid(), запрос уходил на создание, и каждое
      // «Сохранить» заводило на складе дубликат вместо обновления.
      await upsertInventoryItem({
        ...form,
        ...(editing?.id ? { id: editing.id } : {}),
        clinicId: clinic?.id,
        quantity: Number(form.quantity) || 0,
        minQuantity: Number(form.minQuantity) || 0,
        cost: Number(form.cost) || 0,
      } as any)
      showToast(editing ? 'Товар обновлён' : 'Товар добавлен', 'success')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setEditing(null)
    } catch (err: any) {
      showToast(err?.message || 'Не удалось сохранить', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setForm({
      name: item.name || '', quantity: item.quantity || 0, unit: item.unit || 'шт',
      minQuantity: item.minQuantity || item.min || 0, category: item.category || '',
      supplier: item.supplier || '', cost: item.cost || 0,
      // Сервер отдаёт дату целиком, а полю `type="date"` нужен YYYY-MM-DD.
      expiryDate: String((item as any).expiryDate || '').slice(0, 10),
      sku: (item as any).sku || '', productId: (item as any).productId || '',
      autoRestock: (item as any).autoRestock !== false,
    })
    setModalOpen(true)
  }

  /**
   * Приход или списание одним движением.
   *
   * Не присваивание нового количества: пока карточка открыта, остаток мог
   * измениться закрытым приёмом или доставкой заказа, и «+1» поверх старого
   * значения затёр бы их. Плюс движение попадает в историю позиции.
   */
  const quickAdjust = async (item: InventoryItem, delta: number) => {
    try {
      await api.adjustInventoryItem(item.id, delta)
      await queryClient.invalidateQueries({ queryKey: [...queryKeys.inventory, clinic?.id || ''] })
    } catch (err: any) {
      showToast(err?.message || 'Не удалось изменить остаток', 'error')
    }
  }

  const openHistory = async (item: InventoryItem) => {
    setHistoryItem(item)
    setMovements(null)
    try {
      setMovements(await api.getInventoryMovements(item.id))
    } catch {
      setMovements([])
    }
  }

  const getStockVariant = (item: InventoryItem) => {
    const min = item.minQuantity || item.min || 0
    if (min > 0 && item.quantity <= min) return 'error'
    if (min > 0 && item.quantity <= min * 1.5) return 'warning'
    return 'success'
  }

  return (
    <div className="dv-page max-w-full overflow-x-hidden py-4 md:py-6">
      <PageHeader
        title="Склад"
        subtitle={`${clinic?.name} · ${stats.total} позиций`}
        icon={<Package size={20} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" icon={<Plus size={16} />} onClick={() => { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }}>
              Добавить товар
            </Button>
            <Button variant="secondary" className="min-h-11" icon={<PackageMinus size={16} />}
              onClick={() => navigate('/crm/stock-rules')}>
              Списание после приёма
            </Button>
          </div>
        }
      />

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"
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
          <StatCard label="Общая стоимость" value={`${Math.round(stats.totalValue).toLocaleString('ru-RU')} ₸`} icon={<DollarSign size={18} />} />
        </motion.div>
      </motion.div>

      {restockSuggestions.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-semibold text-txt-primary m-0">
                Заканчивается на складе — есть в маркетплейсе
              </p>
              <p className="text-[11px] text-txt-muted m-0">
                Подобрали тот же товар или аналог у продавцов. Можно заказать сразу.
              </p>
              <div className="flex flex-col gap-1.5">
                {restockSuggestions.slice(0, 4).map((row) => {
                  const best = row.matches[0]
                  return (
                    <div key={row.item.id || row.query} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-txt-primary font-medium truncate max-w-full sm:max-w-[220px]">{row.item.name}</span>
                      <span className="text-txt-muted">{row.item.quantity ?? 0}/{row.min}</span>
                      {best && (
                        <span className="text-txt-muted truncate max-w-full sm:max-w-[200px]">
                          → {best.kind === 'exact' ? 'есть' : 'аналог'}: {best.name}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-11"
                        onClick={() => navigate(`/shop?q=${encodeURIComponent(row.query)}`)}
                      >
                        В маркет
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[180px] sm:max-w-[300px]">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." icon={<Search size={16} />} className="min-h-11" />
        </div>
        {[
          { key: 'all', label: 'Все' },
          { key: 'lowStock', label: 'Мало' },
          { key: 'expiring', label: 'Истекает' },
        ].map(f => (
          <Button key={f.key} variant={filter === f.key ? 'outline' : 'ghost'} size="sm"
            onClick={() => {
              setFilter(f.key)
              const next = new URLSearchParams(searchParams)
              if (f.key === 'all') next.delete('filter')
              else next.set('filter', f.key)
              setSearchParams(next, { replace: true })
            }}
            className={filter === f.key ? 'border-dv-gold/50 text-dv-gold min-h-11' : 'min-h-11'}>
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
          className="w-full min-h-11 sm:w-auto"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Package size={32} />} title="Склад пуст" description="Добавьте первый товар" />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {filtered.map(item => {
            const min = item.minQuantity || item.min || 0
            const isLow = min > 0 && item.quantity <= min
            const stockVariant = getStockVariant(item)
            const shopMatch = isLow ? findShopMatches(item, shopProducts, 1)[0] : undefined
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

                    {shopMatch && (
                      <p className="text-[11px] text-txt-muted mb-2 m-0 truncate">
                        {shopMatch.kind === 'exact' ? 'В маркете' : 'Аналог'}: {shopMatch.name}
                      </p>
                    )}

                    <div className="flex gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                      <Button variant="danger" size="icon-xs" className="min-h-11 min-w-11" icon={<Minus size={12} />} onClick={() => quickAdjust(item, -1)} aria-label="Уменьшить на 1" />
                      <Button variant="primary" size="icon-xs" className="min-h-11 min-w-11" icon={<Plus size={12} />} onClick={() => quickAdjust(item, 1)} aria-label="Увеличить на 1" />
                      <Button variant="primary" size="icon-xs" className="min-h-11 min-w-11" onClick={() => quickAdjust(item, 10)}>+10</Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="min-h-11 min-w-11"
                        title="История движений"
                        icon={<History size={12} />}
                        onClick={() => openHistory(item)}
                        aria-label={`История движений: ${item.name}`}
                      />
                      {isLow && (
                        <Button
                          variant="secondary"
                          size="icon-xs"
                          className="min-h-11 min-w-11"
                          title={shopMatch ? `Заказать: ${shopMatch.name}` : 'Заказать в Маркетплейсе'}
                          icon={<ShoppingCart size={12} />}
                          onClick={() => navigate(
                            shopMatch?.id
                              ? `/shop/${shopMatch.id}`
                              : `/shop?q=${encodeURIComponent(item.name || '')}`,
                          )}
                          aria-label="Заказать в маркетплейсе"
                        />
                      )}
                    </div>

                    {item.supplier && <p className="text-xs text-txt-muted mt-2">Поставщик: {item.supplier}</p>}
                    {item.expiryDate && (
                      <p className={cn('text-xs mt-0.5', new Date(item.expiryDate) < new Date() ? 'text-error' : 'text-txt-muted')}>
                        Годен до: {String(item.expiryDate).slice(0, 10)}
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
        className="max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <InventoryItemPicker
            value={form.name}
            autoFocus={!editing}
            onChange={(name) => setForm(f => ({ ...f, name }))}
            onPick={(s) => {
              // Позиция с таким названием уже заведена — открываем её вместо
              // создания второй. Иначе подсказка честно писала бы «уже на
              // складе», а выбор всё равно вёл бы к дубликату.
              const known = s.existingItemId
                ? inventory.find(i => i.id === s.existingItemId)
                : undefined
              if (known) {
                openEdit(known)
                showToast(`«${known.name}» уже на складе — открыли карточку`, 'info')
                return
              }
              // Один выбор заполняет всю карточку: название, категорию,
              // единицу, цену, поставщика и связь с товаром маркета.
              setForm(f => ({
                ...f,
                name: s.name,
                category: s.category || f.category,
                unit: s.unit || f.unit,
                cost: s.price ?? f.cost,
                supplier: s.supplier || f.supplier,
                sku: s.sku || '',
                productId: s.productId || '',
              }))
            }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Кол-во" type="number" min="0" value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })} className="min-h-11" />
            <Select label="Ед. изм." value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              options={INVENTORY_UNITS as any} className="min-h-11" />
            <Input label="Мин. кол-во" type="number" min="0" value={form.minQuantity}
              onChange={e => setForm({ ...form, minQuantity: e.target.value })} className="min-h-11" />
          </div>
          <Select label="Категория" value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            options={[{ value: '', label: '--- Без категории ---' }, ...INVENTORY_CATEGORIES.map(c => ({ value: c, label: c }))]} className="min-h-11" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Цена за ед. (₸)" type="number" min="0" value={form.cost}
              onChange={e => setForm({ ...form, cost: e.target.value })} className="min-h-11" />
            <Input label="Годен до" type="date" value={form.expiryDate}
              onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="min-h-11" />
          </div>
          <Input label="Поставщик" value={form.supplier}
            onChange={e => setForm({ ...form, supplier: e.target.value })}
            placeholder="Название компании" className="min-h-11" />
          <label className="flex items-start gap-3 rounded-lg border border-bdr-subtle bg-surface-1 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoRestock}
              onChange={e => setForm({ ...form, autoRestock: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-dv-gold"
            />
            <span>
              <span className="block text-sm font-medium text-txt-primary">Приходовать автоматически</span>
              <span className="block text-2xs text-txt-muted mt-0.5">
                Когда заказ из маркетплейса доставлен, остаток вырастет сам.
                Снимите, если приходуете эту позицию по факту вскрытия коробки.
              </span>
            </span>
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 min-h-11" disabled={submitting}>{submitting ? 'Сохранение…' : (editing ? 'Сохранить' : 'Добавить')}</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="min-h-11">Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!historyItem}
        onClose={() => setHistoryItem(null)}
        title={historyItem ? `История: ${historyItem.name}` : 'История движений'}
        size="md"
        className="max-w-[95vw] sm:max-w-lg"
      >
        {movements === null ? (
          <p className="text-sm text-txt-muted py-6 text-center">Загружаем…</p>
        ) : movements.length === 0 ? (
          <EmptyState
            icon={<History size={28} />}
            title="Движений пока нет"
            description="Здесь появятся приходы из заказов, списания после приёмов и правки вручную."
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-bdr-subtle bg-surface-1 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-txt-primary m-0">{MOVEMENT_LABELS[m.reason] || m.reason}</p>
                  {m.note && <p className="text-2xs text-txt-muted m-0 mt-0.5 truncate">{m.note}</p>}
                  <p className="text-2xs text-txt-muted m-0 mt-0.5">
                    {new Date(m.createdAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <span className={cn(
                  'shrink-0 text-sm font-bold tabular-nums',
                  m.delta > 0 ? 'text-success' : 'text-error',
                )}>
                  {m.delta > 0 ? '+' : ''}{m.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

const MOVEMENT_LABELS: Record<string, string> = {
  order_delivery: 'Приход из заказа',
  appointment_close: 'Списание после приёма',
  manual: 'Приход вручную',
  correction: 'Правка остатка',
}
