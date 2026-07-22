import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store, Package, Wallet, BarChart3, Plus, Trash2, CheckCircle2, Clock,
  ShieldCheck, Building2, Sparkles, TrendingUp, AlertTriangle, RotateCcw,
  Megaphone, Tag, Star, Truck, ArrowRight, Box, Percent, Camera, ImageIcon,
} from 'lucide-react'
import * as api from '@/utils/api'
import { useToast } from '@/components/ui/ds/Toast'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Modal } from '@/components/ui/ds/Modal'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { PROFILE_PHOTO_ACCEPT, readImageAsDataUrl } from '@/lib/image-upload'

type TabId = 'overview' | 'sales' | 'stock' | 'returns' | 'ads' | 'analytics' | 'catalog' | 'profile'

interface SupplierCtx {
  scopeId: string
  role: string
  supplier?: { id: string; name: string; status: string }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'На проверке',
  DOCUMENTS_REVIEW: 'Проверка документов',
  VERIFIED: 'Проверен',
  OFFICIAL_PARTNER: 'Официальный партнёр',
  SUSPENDED: 'Приостановлен',
}

const ORDER_STATUS: Record<string, string> = {
  pending: 'Новый',
  awaiting_payment: 'Ждёт оплаты',
  placed: 'Оформлен',
  paid: 'Оплачен',
  packing: 'Сборка',
  shipped: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
  refunded: 'Возврат',
}

function fmtMoney(minor: string | number | undefined): string {
  const n = Number(minor || 0) / 100
  return n.toLocaleString('ru-RU') + ' ₸'
}

function fmtTenge(value: number): string {
  return Math.round(value).toLocaleString('ru-RU') + ' ₸'
}

const insightIcon = (type: string) => {
  switch (type) {
    case 'stock': return <AlertTriangle size={16} />
    case 'demand': return <TrendingUp size={16} />
    case 'price': return <Tag size={16} />
    case 'rating': return <Star size={16} />
    case 'return': return <RotateCcw size={16} />
    case 'promo': return <Megaphone size={16} />
    default: return <Sparkles size={16} />
  }
}

const severityClass: Record<string, string> = {
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
}

export default function SupplierWorkspace() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [contexts, setContexts] = useState<SupplierCtx[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('overview')

  const [me, setMe] = useState<any>(null)
  const [dash, setDash] = useState<any>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [promoOpen, setPromoOpen] = useState(false)
  const [form, setForm] = useState({ name: '', price: '', stock: '', category: '', description: '', imageUrl: '' })
  const [promoForm, setPromoForm] = useState({ productId: '', title: '', discountPercent: '10', cashbackPercent: '10' })
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [cashbackRules, setCashbackRules] = useState<any[]>([])
  const [defaultCb, setDefaultCb] = useState('1')
  const [cbSaving, setCbSaving] = useState(false)

  const [regForm, setRegForm] = useState({ name: '', bin: '', phone: '', email: '', contactPerson: '', legalAddress: '' })
  const [regSaving, setRegSaving] = useState(false)

  const loadAll = useCallback(async (t: string) => {
    const [meRes, dashRes, rulesRes] = await Promise.all([
      api.supplierWs.me(t).catch(() => null),
      api.supplierWs.dashboard(t).catch(() => null),
      api.supplierWs.cashbackRules(t).catch(() => ({ rules: [] })),
    ])
    setMe(meRes)
    setDash(dashRes)
    const rules = Array.isArray(rulesRes?.rules) ? rulesRes.rules : []
    setCashbackRules(rules)
    const allRule = rules.find((r: any) => r.scope === 'ALL' && r.active)
    if (allRule) setDefaultCb(String((allRule.rateBps / 100).toFixed(1)).replace(/\.0$/, ''))
  }, [])

  const enterSupplier = useCallback(async (scopeId: string) => {
    try {
      const res = await api.switchContext('SUPPLIER', scopeId)
      setToken(res.accessToken)
      await loadAll(res.accessToken)
    } catch {
      toast.error('Не удалось войти в кабинет поставщика')
    }
  }, [loadAll, toast])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.getMyContexts()
        const sup = (res.contexts || []).filter((c: any) => c.scopeType === 'SUPPLIER')
        setContexts(sup)
        if (sup.length > 0) await enterSupplier(sup[0].scopeId)
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reloadContexts = async () => {
    const res = await api.getMyContexts()
    const sup = (res.contexts || []).filter((c: any) => c.scopeType === 'SUPPLIER')
    setContexts(sup)
    if (sup.length > 0) await enterSupplier(sup[0].scopeId)
  }

  const handleRegister = async () => {
    if (!regForm.name.trim()) { toast.error('Укажите название компании'); return }
    setRegSaving(true)
    try {
      const supplier = await api.registerAsSupplier({
        name: regForm.name.trim(),
        bin: regForm.bin || undefined,
        phone: regForm.phone || undefined,
        email: regForm.email || undefined,
        contactPerson: regForm.contactPerson || undefined,
        legalAddress: regForm.legalAddress || undefined,
      })
      toast.success('Кабинет создан. Статус: на проверке')
      await reloadContexts()
      if (supplier?.id) await enterSupplier(supplier.id)
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось зарегистрировать компанию')
    } finally {
      setRegSaving(false)
    }
  }

  const canWrite = me?.myRole === 'owner' || me?.myRole === 'manager'
  const products = dash?.products || []
  const kpis = dash?.kpis || {}
  const insights = dash?.insights || []

  const handlePhotoFile = async (file: File | null) => {
    try {
      setPhotoUploading(true)
      const dataUrl = await readImageAsDataUrl(file)
      setForm((f) => ({ ...f, imageUrl: dataUrl }))
      toast.success('Фото загружено')
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось загрузить фото')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleAdd = async () => {
    if (!token) return
    if (!form.name.trim() || !form.price) { toast.error('Введите название и цену'); return }
    setSaving(true)
    try {
      await api.supplierWs.createProduct(token, {
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        category: form.category || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
      })
      toast.success('Товар добавлен')
      setAddOpen(false)
      setForm({ name: '', price: '', stock: '', category: '', description: '', imageUrl: '' })
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при добавлении')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) return
    try {
      await api.supplierWs.deleteProduct(token, id)
      toast.success('Товар удалён')
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при удалении')
    }
  }

  const handleStock = async (id: string, stock: number) => {
    if (!token) return
    try {
      await api.supplierWs.updateProduct(token, id, { stock })
      await loadAll(token)
      toast.success('Остаток обновлён')
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось обновить остаток')
    }
  }

  const handleOrderStatus = async (id: string, status: string) => {
    if (!token) return
    try {
      await api.supplierWs.updateOrderStatus(token, id, status)
      toast.success('Статус заказа обновлён')
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось обновить заказ')
    }
  }

  const handlePromo = async () => {
    if (!token || !promoForm.productId) { toast.error('Выберите товар'); return }
    setSaving(true)
    try {
      await api.supplierWs.createPromotion(token, {
        productId: promoForm.productId,
        title: promoForm.title || undefined,
        discountPercent: Number(promoForm.discountPercent) || 10,
        cashbackPercent: Number(promoForm.cashbackPercent) || 10,
      })
      toast.success('Акция и правило кэшбэка созданы')
      setPromoOpen(false)
      setPromoForm({ productId: '', title: '', discountPercent: '10', cashbackPercent: '10' })
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось создать акцию')
    } finally {
      setSaving(false)
    }
  }

  const saveDefaultCashback = async () => {
    if (!token) return
    setCbSaving(true)
    try {
      const pct = Math.min(15, Math.max(0, Number(defaultCb) || 0))
      await api.supplierWs.upsertCashbackRule(token, {
        scope: 'ALL',
        rateBps: Math.round(pct * 100),
        active: true,
      })
      toast.success('Базовый кэшбэк сохранён')
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    } finally {
      setCbSaving(false)
    }
  }

  const toggleOwnBrand = async (productId: string, ownBrand: boolean) => {
    if (!token) return
    try {
      await api.supplierWs.updateProduct(token, productId, { ownBrand })
      toast.success(ownBrand ? 'Свой бренд' : 'Обычный товар')
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    }
  }

  const setProductCashback = async (productId: string, percentStr: string) => {
    if (!token) return
    const pct = Math.min(15, Math.max(0, Number(percentStr) || 0))
    try {
      await api.supplierWs.upsertCashbackRule(token, {
        scope: 'PRODUCT',
        productId,
        rateBps: Math.round(pct * 100),
        active: pct > 0,
      })
      toast.success('Кэшбэк товара обновлён')
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    }
  }

  const handlePayout = async () => {
    if (!token) return
    const balance = Number(kpis.balanceMinor || 0)
    if (balance <= 0) { toast.error('Нет средств для вывода'); return }
    try {
      await api.supplierWs.requestPayout(token, { amountMinor: String(balance) })
      toast.success('Заявка на выплату создана')
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при запросе выплаты')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
      </div>
    )
  }

  if (contexts.length === 0) {
    return (
      <div className="p-6 max-w-[900px] mx-auto space-y-4">
        <PageHeader
          title="Кабинет продавца"
          subtitle="Kaspi для стоматологии — продажи, остатки, AI и реклама"
          icon={<Store size={22} />}
        />
        <EmptyState
          icon={<Store size={36} />}
          title="Откройте кабинет поставщика"
          description="Зарегистрируйте компанию и продавайте клиникам расходники, оборудование и материалы на маркетплейсе DentVision."
        />
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-white">Регистрация компании</p>
            <Input label="Название компании *" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} placeholder="ТОО DentSupply" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="БИН" value={regForm.bin} onChange={(e) => setRegForm({ ...regForm, bin: e.target.value })} />
              <Input label="Телефон" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} />
              <Input label="Email" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
              <Input label="Контактное лицо" value={regForm.contactPerson} onChange={(e) => setRegForm({ ...regForm, contactPerson: e.target.value })} />
            </div>
            <Input label="Юр. адрес" value={regForm.legalAddress} onChange={(e) => setRegForm({ ...regForm, legalAddress: e.target.value })} />
            <div className="flex justify-end pt-1">
              <Button onClick={handleRegister} disabled={regSaving}>{regSaving ? 'Создание…' : 'Создать кабинет'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'overview', label: 'Обзор', icon: <Sparkles size={15} /> },
    { id: 'sales', label: 'Продажи', icon: <Truck size={15} />, count: (dash?.orders || []).length },
    { id: 'stock', label: 'Остатки', icon: <Box size={15} />, count: kpis.lowStockCount },
    { id: 'returns', label: 'Возвраты', icon: <RotateCcw size={15} />, count: kpis.openReturns },
    { id: 'ads', label: 'Реклама', icon: <Megaphone size={15} /> },
    { id: 'analytics', label: 'Спрос', icon: <BarChart3 size={15} /> },
    { id: 'catalog', label: 'Каталог', icon: <Package size={15} /> },
    { id: 'profile', label: 'Профиль', icon: <Building2 size={15} /> },
  ]

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-5">
      <PageHeader
        title="Кабинет продавца"
        subtitle={`${me?.name || 'Поставщик'} · Kaspi для стоматологии`}
        icon={<Store size={22} />}
        actions={me && (
          <Badge variant={me.status === 'VERIFIED' || me.status === 'OFFICIAL_PARTNER' ? 'success' : 'gold'}>
            {me.status === 'VERIFIED' || me.status === 'OFFICIAL_PARTNER'
              ? <ShieldCheck size={12} className="inline mr-1" />
              : <Clock size={12} className="inline mr-1" />}
            {STATUS_LABEL[me.status] || me.status}
          </Badge>
        )}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCell icon={<Wallet size={16} />} label="К выплате" value={fmtMoney(kpis.balanceMinor)} />
        <StatCell icon={<TrendingUp size={16} />} label="Выручка 30 дн" value={fmtTenge(kpis.revenue30 || 0)} />
        <StatCell icon={<CheckCircle2 size={16} />} label="Заказов" value={String(kpis.orders30 || 0)} />
        <StatCell icon={<Star size={16} />} label="Рейтинг" value={kpis.avgRating != null ? String(kpis.avgRating) : '—'} />
        <StatCell icon={<AlertTriangle size={16} />} label="Низкий остаток" value={String(kpis.lowStockCount || 0)} />
        <StatCell icon={<RotateCcw size={16} />} label="Возвраты" value={String(kpis.openReturns || 0)} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-transparent text-[#7A8899] hover:text-white'
            }`}
          >
            {t.icon}{t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-[#C9A96E]" /> AI-рекомендации
                </h3>
                {canWrite && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPromoOpen(true)} icon={<Tag size={14} />}>Акция</Button>
                    <Button size="sm" onClick={() => setAddOpen(true)} icon={<Plus size={14} />}>Товар</Button>
                  </div>
                )}
              </div>

              {insights.length === 0 ? (
                <EmptyState
                  icon={<Sparkles size={28} />}
                  title="Пока нет сигналов"
                  description="Добавьте товары и получите первые заказы — AI подскажет по остаткам и спросу."
                />
              ) : (
                <div className="space-y-2">
                  {insights.map((ins: any) => (
                    <div key={ins.id} className={`rounded-xl border p-4 ${severityClass[ins.severity] || severityClass.info}`}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 opacity-90">{insightIcon(ins.type)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{ins.title}</p>
                          <p className="text-sm opacity-90 mt-1">{ins.message}</p>
                          {ins.productName && (
                            <button
                              className="text-xs mt-2 underline underline-offset-2 opacity-80 hover:opacity-100"
                              onClick={() => setTab('stock')}
                            >
                              Открыть «{ins.productName}» <ArrowRight size={10} className="inline" />
                            </button>
                          )}
                        </div>
                        {ins.metric != null && (
                          <Badge size="xs" variant="gold">{ins.metric}{ins.type === 'demand' ? '%' : ''}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-[#7A8899] uppercase tracking-wide">Последние продажи</p>
                    {(dash?.orders || []).slice(0, 4).map((o: any) => (
                      <div key={o.id} className="flex justify-between text-sm gap-2">
                        <span className="text-white truncate">{o.clinicName}</span>
                        <span className="text-[#C9A96E] shrink-0">{fmtTenge(o.subtotal)}</span>
                      </div>
                    ))}
                    {(dash?.orders || []).length === 0 && <p className="text-sm text-[#7A8899]">Заказов пока нет</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-[#7A8899] uppercase tracking-wide">Критичные остатки</p>
                    {(dash?.stock?.low || []).slice(0, 4).map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm gap-2">
                        <span className="text-white truncate">{p.name}</span>
                        <span className="text-amber-300 shrink-0">{p.stock} шт</span>
                      </div>
                    ))}
                    {(dash?.stock?.low || []).length === 0 && <p className="text-sm text-[#7A8899]">Все остатки в норме</p>}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {tab === 'sales' && (
            <div className="space-y-3">
              <p className="text-sm text-[#7A8899]">Заказы клиник по вашим товарам</p>
              {(dash?.orders || []).length === 0 ? (
                <EmptyState icon={<Truck size={28} />} title="Продаж пока нет" description="Когда клиника оформит заказ с вашим товаром, он появится здесь." />
              ) : (
                (dash.orders as any[]).map((o) => (
                  <Card key={o.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{o.clinicName}</p>
                          <p className="text-xs text-[#7A8899]">
                            {o.buyerName} · {new Date(o.createdAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge size="xs">{ORDER_STATUS[o.status] || o.status}</Badge>
                          <p className="text-sm font-bold text-[#C9A96E] mt-1">{fmtTenge(o.subtotal)}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {o.items.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs text-[#A8B4C0]">
                            <span>{it.name} × {it.qty}</span>
                            <span>{fmtTenge(it.total)}</span>
                          </div>
                        ))}
                      </div>
                      {canWrite && !['delivered', 'cancelled', 'refunded'].includes(o.status) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {o.status !== 'packing' && (
                            <Button size="xs" variant="secondary" onClick={() => handleOrderStatus(o.id, 'packing')}>В сборку</Button>
                          )}
                          {o.status !== 'shipped' && (
                            <Button size="xs" variant="secondary" onClick={() => handleOrderStatus(o.id, 'shipped')}>Отправить</Button>
                          )}
                          <Button size="xs" onClick={() => handleOrderStatus(o.id, 'delivered')}>Доставлен</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === 'stock' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#7A8899]">Управление остатками · низкий порог ≤ 5 шт</p>
                {canWrite && <Button size="sm" onClick={() => setAddOpen(true)} icon={<Plus size={14} />}>Добавить</Button>}
              </div>
              {products.length === 0 ? (
                <EmptyState icon={<Box size={28} />} title="Нет товаров" description="Добавьте первый SKU в каталог." />
              ) : (
                products.map((p: any) => (
                  <Card key={p.id} className={p.stock <= 5 ? 'ring-1 ring-amber-500/30' : ''}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                        <p className="text-xs text-[#7A8899]">{p.category || 'Без категории'} · {fmtTenge(p.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          className="w-24"
                          value={String(p.stock)}
                          onChange={(e) => {
                            const next = Number(e.target.value)
                            setDash((d: any) => ({
                              ...d,
                              products: d.products.map((x: any) => x.id === p.id ? { ...x, stock: next } : x),
                            }))
                          }}
                          onBlur={(e) => handleStock(p.id, Number(e.target.value) || 0)}
                          disabled={!canWrite}
                        />
                        <span className="text-xs text-[#7A8899]">шт</span>
                        {p.stock <= 5 && <Badge size="xs" variant="gold">мало</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === 'returns' && (
            <div className="space-y-3">
              <p className="text-sm text-[#7A8899]">Возвраты и споры по вашим заказам</p>
              {(dash?.returns || []).length === 0 ? (
                <EmptyState icon={<RotateCcw size={28} />} title="Возвратов нет" description="Открытые споры появятся здесь автоматически." />
              ) : (
                (dash.returns as any[]).map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4 flex justify-between gap-3">
                      <div>
                        <p className="text-sm text-white">{r.reason}</p>
                        <p className="text-xs text-[#7A8899] mt-1">{r.refType} · {r.refId}</p>
                      </div>
                      <Badge size="xs">{r.status}</Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === 'ads' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Percent size={16} className="text-[#C9A96E] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">DentCash — кэшбэк покупателям</p>
                      <p className="text-xs text-[#7A8899] mt-0.5">
                        1 DentCash = 1 ₸. Списывается с вашего кошелька при начислении. Свой бренд — повышенный % по умолчанию платформы.
                      </p>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex flex-wrap items-end gap-3">
                      <Input
                        label="Базовый кэшбэк %"
                        type="number"
                        value={defaultCb}
                        onChange={(e) => setDefaultCb(e.target.value)}
                        className="w-28"
                      />
                      <Button size="sm" loading={cbSaving} onClick={() => void saveDefaultCashback()}>
                        Сохранить
                      </Button>
                    </div>
                  )}
                  {cashbackRules.filter((r) => r.active && r.scope !== 'ALL').length > 0 && (
                    <div className="text-xs text-[#7A8899] space-y-1 pt-2 border-t border-white/10">
                      <p className="font-medium text-white/60">Переопределения</p>
                      {cashbackRules.filter((r) => r.active && r.scope !== 'ALL').map((r) => (
                        <p key={r.id}>
                          {r.scope}
                          {r.productId ? ` · ${String(r.productId).slice(0, 8)}…` : ''}
                          {r.category ? ` · ${r.category}` : ''}
                          {' — '}
                          {(r.rateBps / 100).toFixed(1)}%
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <p className="text-sm text-[#7A8899]">Акции с повышенным кэшбэком (до 15%)</p>
                {canWrite && <Button size="sm" onClick={() => setPromoOpen(true)} icon={<Tag size={14} />}>Создать акцию</Button>}
              </div>
              {(dash?.promotions || []).length > 0 ? (
                <div className="space-y-2">
                  {(dash.promotions as any[]).map((p: any) => (
                    <div key={p.id} className="rounded-lg border border-[#C9A96E]/20 bg-[#C9A96E]/5 px-3 py-2 text-sm text-white">
                      {p.title} · {p.productName}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#7A8899]">Пока нет активных акций</p>
              )}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-[#7A8899]">Товары: свой бренд и % кэшбэка</p>
                {products.length === 0 ? (
                  <p className="text-sm text-[#7A8899]">Добавьте товары во вкладке «Каталог»</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {products.slice(0, 40).map((p: any) => {
                      const rule = cashbackRules.find((r) => r.scope === 'PRODUCT' && r.productId === p.id && r.active)
                      return (
                        <Card key={p.id}>
                          <CardContent className="p-3 flex flex-wrap items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{p.name}</p>
                              <p className="text-xs text-[#7A8899]">{p.category || '—'}</p>
                            </div>
                            {canWrite && (
                              <>
                                <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(p.ownBrand)}
                                    onChange={(e) => void toggleOwnBrand(p.id, e.target.checked)}
                                    className="rounded border-white/20"
                                  />
                                  Свой бренд
                                </label>
                                <Input
                                  label=""
                                  type="number"
                                  defaultValue={rule ? String(rule.rateBps / 100) : ''}
                                  placeholder="%"
                                  className="w-20"
                                  onBlur={(e) => {
                                    if (e.target.value !== '') void setProductCashback(p.id, e.target.value)
                                  }}
                                />
                              </>
                            )}
                            {!canWrite && rule && (
                              <span className="text-xs text-[#C9A96E]">{(rule.rateBps / 100).toFixed(1)}%</span>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'analytics' && (
            <div className="space-y-4">
              <p className="text-sm text-[#7A8899]">Аналитика спроса по вашему ассортименту</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCell icon={<BarChart3 size={16} />} label="Продаж всего" value={String(kpis.salesCount || 0)} />
                <StatCell icon={<Wallet size={16} />} label="Заработано" value={fmtMoney(kpis.earnedMinor)} />
                <StatCell icon={<Package size={16} />} label="SKU" value={String(kpis.productCount || 0)} />
                <StatCell icon={<Star size={16} />} label="Рейтинг" value={kpis.avgRating != null ? String(kpis.avgRating) : '—'} />
              </div>
              {(dash?.demandTop || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-[#7A8899]">Горячий спрос</p>
                  {(dash.demandTop as any[]).map((d) => (
                    <div key={d.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <p className="text-sm font-semibold text-emerald-100">{d.title}</p>
                      <p className="text-sm text-emerald-100/90 mt-1">{d.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<TrendingUp size={28} />}
                  title="Спрос пока стабильный"
                  description="Когда клиники начнут чаще покупать ваши позиции, здесь появятся сигналы роста."
                />
              )}
              <Button variant="outline" icon={<Wallet size={15} />} disabled={!canWrite || Number(kpis.balanceMinor) <= 0} onClick={handlePayout}>
                Запросить выплату ({fmtMoney(kpis.balanceMinor)})
              </Button>
            </div>
          )}

          {tab === 'catalog' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#7A8899]">Товаров: {products.length}</p>
                {canWrite && <Button size="sm" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>Добавить товар</Button>}
              </div>
              {products.length === 0 ? (
                <EmptyState icon={<Package size={32} />} title="Нет товаров" description="Добавьте первый товар в каталог." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {products.map((p: any, i: number) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3 min-w-0">
                              <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ImageIcon size={18} className="text-[#7A8899]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{p.name}</p>
                                <p className="text-xs text-[#7A8899] mt-0.5">{p.category || 'Без категории'} · остаток {p.stock}</p>
                                <p className="text-sm text-[#C9A96E] font-semibold mt-1.5">{fmtTenge(p.price)}</p>
                                {p.rating != null && (
                                  <p className="text-xs text-[#7A8899] mt-1 flex items-center gap-1">
                                    <Star size={11} className="text-[#C9A96E]" /> {p.rating}
                                  </p>
                                )}
                              </div>
                            </div>
                            {canWrite && (
                              <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-[#E74C3C] hover:bg-[#E74C3C]/10 transition-colors shrink-0" aria-label="Удалить">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && me && (
            <ProfileTab me={me} canWrite={canWrite} token={token!} onSaved={() => token && loadAll(token)} />
          )}
        </motion.div>
      </AnimatePresence>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Новый товар">
        <div className="space-y-3">
          <Input label="Название *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Имплант Straumann BLT" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Цена, ₸ *" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="150000" />
            <Input label="Остаток" type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="10" />
          </div>
          <Input label="Категория" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Импланты" />
          <Input label="Описание" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Краткое описание" />
          <div>
            <p className="text-xs text-[#7A8899] mb-1.5">Фото товара</p>
            <input
              ref={photoInputRef}
              type="file"
              accept={PROFILE_PHOTO_ACCEPT}
              className="hidden"
              onChange={(e) => {
                void handlePhotoFile(e.target.files?.[0] || null)
                e.target.value = ''
              }}
            />
            {form.imageUrl ? (
              <div className="relative h-36 rounded-lg overflow-hidden border border-white/10 mb-2">
                <img src={form.imageUrl} alt="Превью" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                  className="absolute top-2 right-2 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white border-none cursor-pointer"
                >
                  Убрать
                </button>
              </div>
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-white/15 bg-white/[0.03] flex items-center justify-center mb-2">
                <ImageIcon size={22} className="text-[#7A8899]" />
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Camera size={14} />}
              loading={photoUploading}
              onClick={() => photoInputRef.current?.click()}
            >
              {form.imageUrl ? 'Заменить фото' : 'Добавить фото'}
            </Button>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button loading={saving} onClick={handleAdd} icon={<Plus size={15} />}>Добавить</Button>
          </div>
        </div>
      </Modal>

      <Modal open={promoOpen} onClose={() => setPromoOpen(false)} title="Запустить акцию">
        <div className="space-y-3">
          <label className="text-xs text-[#7A8899] block">Товар</label>
          <select
            value={promoForm.productId}
            onChange={(e) => setPromoForm((f) => ({ ...f, productId: e.target.value }))}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
          >
            <option value="">Выберите товар…</option>
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Input label="Название акции" value={promoForm.title} onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))} placeholder="−10% на расходники" />
          <Input label="Скидка %" type="number" value={promoForm.discountPercent} onChange={(e) => setPromoForm((f) => ({ ...f, discountPercent: e.target.value }))} />
          <Input
            label="Кэшбэк DentCash %"
            type="number"
            value={promoForm.cashbackPercent}
            onChange={(e) => setPromoForm((f) => ({ ...f, cashbackPercent: e.target.value }))}
            placeholder="до 15%"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setPromoOpen(false)}>Отмена</Button>
            <Button loading={saving} onClick={handlePromo} icon={<Tag size={15} />}>Запустить</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3.5 bg-[#0D1B2E] border border-[rgba(255,255,255,0.06)] rounded-[14px]">
      <div className="flex items-center gap-2 text-[#C9A96E] mb-1.5">{icon}</div>
      <p className="text-lg font-bold text-white leading-tight">{value}</p>
      <p className="text-[11px] text-[#7A8899] mt-0.5">{label}</p>
    </div>
  )
}

function ProfileTab({ me, canWrite, token, onSaved }: { me: any; canWrite: boolean; token: string; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: me.name || '', bin: me.bin || '', legalAddress: me.legalAddress || '', contactPerson: me.contactPerson || '', phone: me.phone || '', email: me.email || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.supplierWs.updateMe(token, form)
      toast.success('Профиль сохранён')
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-[560px] space-y-3">
      <Input label="Название компании" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={!canWrite} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="БИН" value={form.bin} onChange={(e) => setForm((f) => ({ ...f, bin: e.target.value }))} disabled={!canWrite} />
        <Input label="Контактное лицо" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} disabled={!canWrite} />
      </div>
      <Input label="Юридический адрес" value={form.legalAddress} onChange={(e) => setForm((f) => ({ ...f, legalAddress: e.target.value }))} disabled={!canWrite} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Телефон" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} disabled={!canWrite} />
        <Input label="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!canWrite} />
      </div>
      {canWrite && <Button loading={saving} onClick={save}>Сохранить профиль</Button>}
    </div>
  )
}
