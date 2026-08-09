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
import { SUPPLIER_BENEFITS, PartnerBenefits } from '@/components/PartnerBenefits';

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

  // Product Presets (quick-import)
  const [importOpen, setImportOpen] = useState(false)
  const [presets, setPresets] = useState<any[]>([])
  const [presetsLoading, setPresetsLoading] = useState(false)
  const [presetSearch, setPresetSearch] = useState('')
  const [quickPrice, setQuickPrice] = useState<Record<string, string>>({})
  const [quickStock, setQuickStock] = useState<Record<string, string>>({})
  const [quickAdding, setQuickAdding] = useState<string | null>(null)

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

  const loadPresets = useCallback(async (search?: string) => {
    setPresetsLoading(true)
    try {
      const res = await api.getProductPresets({ search })
      setPresets(Array.isArray(res.data) ? res.data : [])
    } catch { /* ignore */ } finally {
      setPresetsLoading(false)
    }
  }, [])

  const handleQuickAdd = async (preset: any) => {
    if (!token) return
    const price = quickPrice[preset.id]
    if (!price) { toast.error('Укажите цену'); return }
    setQuickAdding(preset.id)
    try {
      await api.quickAddPreset(preset.id, Number(price), Number(quickStock[preset.id]) || 10)
      toast.success(`${preset.name} — добавлен в каталог`)
      setQuickPrice((p) => { const n = { ...p }; delete n[preset.id]; return n })
      setQuickStock((s) => { const n = { ...s }; delete n[preset.id]; return n })
      await loadAll(token)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при добавлении')
    } finally {
      setQuickAdding(null)
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
        <div className="h-9 w-9 rounded-full border-[3px] border-dv-gold/30 border-t-dv-gold animate-spin" />
      </div>
    )
  }

  if (contexts.length === 0) {
    return (
      <div className="p-6 max-w-full md:max-w-[900px] overflow-x-hidden mx-auto space-y-4">
        <PageHeader
          title="Кабинет продавца"
          subtitle="Продажи, остатки, AI и реклама в маркетплейсе DentVision"
          icon={<Store size={22} />}
        />
        <EmptyState
          icon={<Store size={36} />}
          title="Откройте кабинет поставщика"
          description="Зарегистрируйте компанию и продавайте клиникам расходники, оборудование и материалы на маркетплейсе DentVision."
        />
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-txt-primary">Регистрация компании</p>
            <Input label="Название компании *" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} placeholder="ТОО DentSupply" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="БИН" value={regForm.bin} onChange={(e) => setRegForm({ ...regForm, bin: e.target.value })} />
              <Input label="Телефон" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} />
              <Input label="Email" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
              <Input label="Контактное лицо" value={regForm.contactPerson} onChange={(e) => setRegForm({ ...regForm, contactPerson: e.target.value })} />
            </div>
            <Input label="Юр. адрес" value={regForm.legalAddress} onChange={(e) => setRegForm({ ...regForm, legalAddress: e.target.value })} />
            <div className="flex flex-wrap justify-end pt-1">
              <Button className="min-h-11" onClick={handleRegister} disabled={regSaving}>{regSaving ? 'Создание…' : 'Создать кабинет'}</Button>
            </div>
          </CardContent>
        </Card>
        <PartnerBenefits benefits={SUPPLIER_BENEFITS} />
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
    <div className="p-4 md:p-6 max-w-full xl:max-w-[1280px] overflow-x-hidden mx-auto space-y-5">
      <PageHeader
        title="Кабинет продавца"
        subtitle={`${me?.name || 'Поставщик'} · кабинет продавца DentVision`}
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
            className={`flex items-center gap-1.5 px-3 py-2.5 min-h-11 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-dv-gold text-dv-gold' : 'border-transparent text-txt-muted hover:text-txt-primary'
            }`}
          >
            {t.icon}{t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2">{t.count}</span>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-txt-primary flex items-center gap-2">
                  <Sparkles size={16} className="text-dv-gold" /> AI-рекомендации
                </h3>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setPromoOpen(true)} icon={<Tag size={14} />}>Акция</Button>
                    <Button size="sm" className="min-h-11" onClick={() => setAddOpen(true)} icon={<Plus size={14} />}>Товар</Button>
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
                    <p className="text-xs text-txt-muted uppercase tracking-wide">Последние продажи</p>
                    {(dash?.orders || []).slice(0, 4).map((o: any) => (
                      <div key={o.id} className="flex justify-between text-sm gap-2">
                        <span className="text-txt-primary truncate">{o.clinicName}</span>
                        <span className="text-dv-gold shrink-0">{fmtTenge(o.subtotal)}</span>
                      </div>
                    ))}
                    {(dash?.orders || []).length === 0 && <p className="text-sm text-txt-muted">Заказов пока нет</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-txt-muted uppercase tracking-wide">Критичные остатки</p>
                    {(dash?.stock?.low || []).slice(0, 4).map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm gap-2">
                        <span className="text-txt-primary truncate">{p.name}</span>
                        <span className="text-amber-300 shrink-0">{p.stock} шт</span>
                      </div>
                    ))}
                    {(dash?.stock?.low || []).length === 0 && <p className="text-sm text-txt-muted">Все остатки в норме</p>}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {tab === 'sales' && (
            <div className="space-y-3">
              <p className="text-sm text-txt-muted">Заказы клиник по вашим товарам</p>
              {(dash?.orders || []).length === 0 ? (
                <EmptyState icon={<Truck size={28} />} title="Продаж пока нет" description="Когда клиника оформит заказ с вашим товаром, он появится здесь." />
              ) : (
                (dash.orders as any[]).map((o) => (
                  <Card key={o.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-txt-primary">{o.clinicName}</p>
                          <p className="text-xs text-txt-muted">
                            {o.buyerName} · {new Date(o.createdAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge size="xs">{ORDER_STATUS[o.status] || o.status}</Badge>
                          <p className="text-sm font-bold text-dv-gold mt-1">{fmtTenge(o.subtotal)}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {o.items.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs text-txt-secondary">
                            <span>{it.name} × {it.qty}</span>
                            <span>{fmtTenge(it.total)}</span>
                          </div>
                        ))}
                      </div>
                      {canWrite && !['delivered', 'cancelled', 'refunded'].includes(o.status) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {o.status !== 'packing' && (
                            <Button size="xs" variant="secondary" className="min-h-11" onClick={() => handleOrderStatus(o.id, 'packing')}>В сборку</Button>
                          )}
                          {o.status !== 'shipped' && (
                            <Button size="xs" variant="secondary" className="min-h-11" onClick={() => handleOrderStatus(o.id, 'shipped')}>Отправить</Button>
                          )}
                          <Button size="xs" className="min-h-11" onClick={() => handleOrderStatus(o.id, 'delivered')}>Доставлен</Button>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-txt-muted">Управление остатками · низкий порог ≤ 5 шт</p>
                {canWrite && <Button size="sm" className="min-h-11" onClick={() => setAddOpen(true)} icon={<Plus size={14} />}>Добавить</Button>}
              </div>
              {products.length === 0 ? (
                <EmptyState icon={<Box size={28} />} title="Нет товаров" description="Добавьте первый SKU в каталог." />
              ) : (
                products.map((p: any) => (
                  <Card key={p.id} className={p.stock <= 5 ? 'ring-1 ring-amber-500/30' : ''}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-txt-primary truncate">{p.name}</p>
                        <p className="text-xs text-txt-muted">{p.category || 'Без категории'} · {fmtTenge(p.price)}</p>
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
                        <span className="text-xs text-txt-muted">шт</span>
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
              <p className="text-sm text-txt-muted">Возвраты и споры по вашим заказам</p>
              {(dash?.returns || []).length === 0 ? (
                <EmptyState icon={<RotateCcw size={28} />} title="Возвратов нет" description="Открытые споры появятся здесь автоматически." />
              ) : (
                (dash.returns as any[]).map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4 flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="text-sm text-txt-primary">{r.reason}</p>
                        <p className="text-xs text-txt-muted mt-1">{r.refType} · {r.refId}</p>
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
                    <Percent size={16} className="text-dv-gold mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-txt-primary">DentCash — кэшбэк покупателям</p>
                      <p className="text-xs text-txt-muted mt-0.5">
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
                      <Button size="sm" className="min-h-11" loading={cbSaving} onClick={() => void saveDefaultCashback()}>
                        Сохранить
                      </Button>
                    </div>
                  )}
                  {cashbackRules.filter((r) => r.active && r.scope !== 'ALL').length > 0 && (
                    <div className="text-xs text-txt-muted space-y-1 pt-2 border-t border-bdr-subtle">
                      <p className="font-medium text-txt-primary/60">Переопределения</p>
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-txt-muted">Акции с повышенным кэшбэком (до 15%)</p>
                {canWrite && <Button size="sm" className="min-h-11" onClick={() => setPromoOpen(true)} icon={<Tag size={14} />}>Создать акцию</Button>}
              </div>
              {(dash?.promotions || []).length > 0 ? (
                <div className="space-y-2">
                  {(dash.promotions as any[]).map((p: any) => (
                    <div key={p.id} className="rounded-lg border border-dv-gold/20 bg-dv-gold/5 px-3 py-2 text-sm text-white">
                      {p.title} · {p.productName}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-txt-muted">Пока нет активных акций</p>
              )}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-txt-muted">Товары: свой бренд и % кэшбэка</p>
                {products.length === 0 ? (
                  <p className="text-sm text-txt-muted">Добавьте товары во вкладке «Каталог»</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {products.slice(0, 40).map((p: any) => {
                      const rule = cashbackRules.find((r) => r.scope === 'PRODUCT' && r.productId === p.id && r.active)
                      return (
                        <Card key={p.id}>
                          <CardContent className="p-3 flex flex-wrap items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-txt-primary truncate">{p.name}</p>
                              <p className="text-xs text-txt-muted">{p.category || '—'}</p>
                            </div>
                            {canWrite && (
                              <>
                                <label className="flex items-center gap-1.5 text-xs text-txt-primary/70 cursor-pointer">
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
                              <span className="text-xs text-dv-gold">{(rule.rateBps / 100).toFixed(1)}%</span>
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
              <p className="text-sm text-txt-muted">Аналитика спроса по вашему ассортименту</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCell icon={<BarChart3 size={16} />} label="Продаж всего" value={String(kpis.salesCount || 0)} />
                <StatCell icon={<Wallet size={16} />} label="Заработано" value={fmtMoney(kpis.earnedMinor)} />
                <StatCell icon={<Package size={16} />} label="SKU" value={String(kpis.productCount || 0)} />
                <StatCell icon={<Star size={16} />} label="Рейтинг" value={kpis.avgRating != null ? String(kpis.avgRating) : '—'} />
              </div>
              {(dash?.demandTop || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-txt-muted">Горячий спрос</p>
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
              <Button variant="outline" className="min-h-11" icon={<Wallet size={15} />} disabled={!canWrite || Number(kpis.balanceMinor) <= 0} onClick={handlePayout}>
                Запросить выплату ({fmtMoney(kpis.balanceMinor)})
              </Button>
            </div>
          )}

          {tab === 'catalog' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-sm text-txt-muted">Товаров: {products.length}</p>
                <div className="flex flex-wrap gap-2">
                  {canWrite && <Button size="sm" variant="ghost" className="min-h-11" icon={<Sparkles size={14} />} onClick={() => { loadPresets(); setImportOpen(true) }}>Быстрый импорт</Button>}
                  {canWrite && <Button size="sm" className="min-h-11" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>Добавить товар</Button>}
                </div>
              </div>
              {products.length === 0 ? (
                <EmptyState icon={<Package size={32} />} title="Нет товаров" description="Добавьте первый товар в каталог." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {products.map((p: any, i: number) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3 min-w-0">
                              <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-surface-1 flex items-center justify-center">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ImageIcon size={18} className="text-txt-muted" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-txt-primary truncate">{p.name}</p>
                                <p className="text-xs text-txt-muted mt-0.5">{p.category || 'Без категории'} · остаток {p.stock}</p>
                                <p className="text-sm text-dv-gold font-semibold mt-1.5">{fmtTenge(p.price)}</p>
                                {p.rating != null && (
                                  <p className="text-xs text-txt-muted mt-1 flex items-center gap-1">
                                    <Star size={11} className="text-dv-gold" /> {p.rating}
                                  </p>
                                )}
                              </div>
                            </div>
                            {canWrite && (
                              <button onClick={() => handleDelete(p.id)} className="p-1.5 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-error hover:bg-error/10 transition-colors shrink-0" aria-label="Удалить">
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Новый товар" className="w-full max-w-full sm:max-w-lg lg:max-w-xl">
        <div className="space-y-3">
          <Input label="Название *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Имплант титановый BLT" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Цена, ₸ *" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="150000" />
            <Input label="Остаток" type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="10" />
          </div>
          <Input label="Категория" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Импланты" />
          <Input label="Описание" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Краткое описание" />
          <div>
            <p className="text-xs text-txt-muted mb-1.5">Фото товара</p>
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
              <div className="relative h-36 rounded-lg overflow-hidden border border-bdr-subtle mb-2">
                <img src={form.imageUrl} alt="Превью" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                  className="absolute top-2 right-2 rounded-md bg-black/50 px-2 py-1 text-[11px] text-txt-primary border-none cursor-pointer"
                >
                  Убрать
                </button>
              </div>
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-white/15 bg-surface-1 flex items-center justify-center mb-2">
                <ImageIcon size={22} className="text-txt-muted" />
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              icon={<Camera size={14} />}
              loading={photoUploading}
              onClick={() => photoInputRef.current?.click()}
            >
              {form.imageUrl ? 'Заменить фото' : 'Добавить фото'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="ghost" className="min-h-11" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button loading={saving} className="min-h-11" onClick={handleAdd} icon={<Plus size={15} />}>Добавить</Button>
          </div>
        </div>
      </Modal>

      <Modal open={promoOpen} onClose={() => setPromoOpen(false)} title="Запустить акцию" className="w-full max-w-full sm:max-w-lg lg:max-w-xl">
        <div className="space-y-3">
          <label className="text-xs text-txt-muted block">Товар</label>
          <select
            value={promoForm.productId}
            onChange={(e) => setPromoForm((f) => ({ ...f, productId: e.target.value }))}
            className="w-full rounded-lg bg-surface-1 border border-bdr-subtle px-3 py-2 min-h-11 text-sm text-white"
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
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="ghost" className="min-h-11" onClick={() => setPromoOpen(false)}>Отмена</Button>
            <Button loading={saving} className="min-h-11" onClick={handlePromo} icon={<Tag size={15} />}>Запустить</Button>
          </div>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Быстрый импорт товаров">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <Input
            placeholder="Поиск по названию, бренду…"
            value={presetSearch}
            onChange={(e) => { setPresetSearch(e.target.value); loadPresets(e.target.value) }}
          />
          {presetsLoading ? (
            <p className="text-center text-sm text-txt-muted py-6">Загрузка…</p>
          ) : presets.length === 0 ? (
            <p className="text-center text-sm text-txt-muted py-6">Ничего не найдено</p>
          ) : (
            <div className="space-y-2">
              {presets.map((preset: any) => (
                <div key={preset.id} className="rounded-xl border border-bdr-subtle bg-surface-1 p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-surface-1 flex items-center justify-center">
                      {preset.imageUrl ? (
                        <img src={preset.imageUrl} alt={preset.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={18} className="text-txt-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-txt-primary truncate">{preset.name}</p>
                      {preset.brand && <p className="text-[11px] text-txt-muted">{preset.brand}</p>}
                      {preset.description && <p className="text-xs text-txt-muted mt-1 line-clamp-2">{preset.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {preset.avgPrice > 0 && <span className="text-xs text-dv-gold">Ср. цена: {fmtTenge(preset.avgPrice)}</span>}
                        <span className="text-[10px] text-txt-primary/40">/{preset.unit || 'шт'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Input
                      placeholder="Цена, ₸"
                      type="number"
                      value={quickPrice[preset.id] ?? ''}
                      onChange={(e) => setQuickPrice((p) => ({ ...p, [preset.id]: e.target.value }))}
                    />
                    <Input
                      placeholder="Остаток"
                      type="number"
                      value={quickStock[preset.id] ?? '10'}
                      onChange={(e) => setQuickStock((s) => ({ ...s, [preset.id]: e.target.value }))}
                      className="w-20"
                    />
                    <Button
                      size="sm"
                      className="min-h-11"
                      icon={<Plus size={13} />}
                      loading={quickAdding === preset.id}
                      onClick={() => handleQuickAdd(preset)}
                    >
                      Добавить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3.5 bg-surface-1 border border-bdr-subtle rounded-[14px]">
      <div className="flex items-center gap-2 text-dv-gold mb-1.5">{icon}</div>
      <p className="text-lg font-bold text-txt-primary leading-tight">{value}</p>
      <p className="text-[11px] text-txt-muted mt-0.5">{label}</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="БИН" value={form.bin} onChange={(e) => setForm((f) => ({ ...f, bin: e.target.value }))} disabled={!canWrite} />
        <Input label="Контактное лицо" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} disabled={!canWrite} />
      </div>
      <Input label="Юридический адрес" value={form.legalAddress} onChange={(e) => setForm((f) => ({ ...f, legalAddress: e.target.value }))} disabled={!canWrite} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Телефон" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} disabled={!canWrite} />
        <Input label="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!canWrite} />
      </div>
      {canWrite && <Button loading={saving} onClick={save}>Сохранить профиль</Button>}
    </div>
  )
}
