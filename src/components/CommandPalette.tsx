import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ArrowRight, Calendar, Users, ShoppingCart, GraduationCap,
  BarChart3, Bot, FileText, Settings, Stethoscope, Package, CreditCard,
  Activity, Sparkles, Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { useIam } from '@/iam'
import { useTranslation } from 'react-i18next'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
  section: string
  keywords: string[]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onAIQuery?: (query: string) => void
}

export function CommandPalette({ open, onClose, onAIQuery }: CommandPaletteProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const iam = useIam()

  const categories = [
    { id: 'all', label: 'Все' },
    { id: 'crm', label: 'Клиника' },
    { id: 'diagnostics', label: 'Диагностика' },
    { id: 'shop', label: 'Маркетплейс' },
    { id: 'school', label: 'Academy' },
    { id: 'finance', label: 'Финансы' },
  ]

  const commands: CommandItem[] = useMemo(() => {
    const all: CommandItem[] = [
      // CRM
      { id: 'schedule', label: t('platform.command_schedule'), description: 'Открыть календарь записей', icon: <Calendar size={16} />, action: () => { navigate('/crm/schedule'); onClose() }, section: 'Клиника & CRM', keywords: ['расписание', 'календарь', 'записи', 'appointment', 'прием'] },
      { id: 'patients', label: t('platform.command_patients'), description: 'Список пациентов и поиск', icon: <Users size={16} />, action: () => { navigate('/crm/patients'); onClose() }, section: 'Клиника & CRM', keywords: ['пациенты', 'список', 'patient', 'клиенты'] },
      { id: 'medical-card', label: 'Медицинские карты', description: 'Анамнез и протоколы', icon: <FileText size={16} />, action: () => { navigate('/crm/medical-card'); onClose() }, section: 'Клиника & CRM', keywords: ['медкарта', 'история', 'протокол'] },
      { id: 'dental-chart', label: 'Зубная формула', description: 'Интерактивная карта зубов', icon: <Stethoscope size={16} />, action: () => { navigate('/crm/dental-chart'); onClose() }, section: 'Клиника & CRM', keywords: ['зубная формула', 'карта зубов'] },

      // Diagnostics
      { id: 'diagnostics', label: '3D Диагностика & КТ', description: 'КТ снимки, исследования и центры', icon: <Activity size={16} />, action: () => { navigate('/diagnostics'); onClose() }, section: '3D Диагностика', keywords: ['диагностика', 'кт', 'снимки', '3d', 'скан'] },
      { id: 'referral-new', label: 'Новое направление на КТ', description: 'Направить пациента на исследование', icon: <Activity size={16} />, action: () => { navigate('/diagnostics/referrals/new'); onClose() }, section: '3D Диагностика', keywords: ['направление', 'кт', 'обследование'] },

      // Marketplace
      { id: 'shop', label: t('platform.command_marketplace'), description: 'DentMarket — расходники и инструменты', icon: <ShoppingCart size={16} />, action: () => { navigate('/shop'); onClose() }, section: 'Маркетплейс', keywords: ['магазин', 'товары', 'shop', 'marketplace', 'закупка'] },
      { id: 'shop-orders', label: 'Заказы и доставки', description: 'Статусы покупок', icon: <Package size={16} />, action: () => { navigate('/shop/orders'); onClose() }, section: 'Маркетплейс', keywords: ['заказы', 'доставка', 'покупки'] },

      // School
      { id: 'school', label: t('platform.command_academy'), description: 'Academy OS — курсы и вебинары', icon: <GraduationCap size={16} />, action: () => { navigate('/school'); onClose() }, section: 'Academy OS', keywords: ['школа', 'курсы', 'school', 'academy', 'обучение'] },

      // Finance & Cashier
      { id: 'cashier', label: t('platform.command_cashier'), description: 'Касса, оплаты и чеки', icon: <CreditCard size={16} />, action: () => { navigate('/crm/cashier'); onClose() }, section: 'Финансы & Касса', keywords: ['касса', 'оплата', 'счёт', 'cashier', 'finance', 'чеки'] },
      { id: 'pricelist', label: 'Прейскурант услуг', description: 'Цены на услуги клиники', icon: <Tag size={16} />, action: () => { navigate('/crm/pricelist'); onClose() }, section: 'Финансы & Касса', keywords: ['прейскурант', 'прайс', 'цены'] },
      { id: 'inventory', label: t('platform.command_inventory'), description: 'Учёт материалов и остатков', icon: <Package size={16} />, action: () => { navigate('/crm/inventory'); onClose() }, section: 'Финансы & Касса', keywords: ['склад', 'материалы', 'inventory', 'stock'] },
      { id: 'analytics', label: t('platform.command_analytics'), description: 'Финансовые отчёты и метрики', icon: <BarChart3 size={16} />, action: () => { navigate('/analytics'); onClose() }, section: 'Финансы & Касса', keywords: ['аналитика', 'отчёты', 'analytics', 'выручка'] },

      // Platform
      { id: 'settings', label: t('platform.command_settings'), description: 'Параметры системы', icon: <Settings size={16} />, action: () => { navigate('/settings'); onClose() }, section: 'Платформа', keywords: ['настройки', 'settings'] },
      { id: 'ai-chat', label: 'Jarvis AI Интеллект', description: 'Запустить ИИ-помощника', icon: <Bot size={16} />, action: () => { navigate('/'); onClose() }, section: 'Платформа', keywords: ['ai', 'ассистент', 'помощь', 'умный', 'жарвис'] },
    ]
    return all.filter((cmd) => {
      if (cmd.id === 'settings' || cmd.id === 'ai-chat') return true
      return iam.canAccessPage(cmd.id) || cmd.id.startsWith('referral') || cmd.id.startsWith('shop')
    })
  }, [navigate, onClose, t, iam])

  const filtered = useMemo(() => {
    return commands.filter((cmd) => {
      if (activeCategory !== 'all') {
        const catMap: Record<string, string> = {
          crm: 'Клиника & CRM',
          diagnostics: '3D Диагностика',
          shop: 'Маркетплейс',
          school: 'Academy OS',
          finance: 'Финансы & Касса',
        }
        if (cmd.section !== catMap[activeCategory]) return false
      }

      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.includes(q))
      )
    })
  }, [commands, query, activeCategory])

  const sections = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    filtered.forEach((cmd) => {
      if (!map.has(cmd.section)) map.set(cmd.section, [])
      map.get(cmd.section)!.push(cmd)
    })
    return map
  }, [filtered])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setActiveCategory('all')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, activeCategory])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
      } else if (query.trim()) {
        onAIQuery?.(query)
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [filtered, selectedIndex, query, onAIQuery, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[10vh] px-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-xl bg-surface-1 border border-bdr-subtle rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Search Bar Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-bdr-subtle bg-surface-2/40">
                <Search size={18} className="text-dv-gold shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Быстрый поиск по всей платформе (Поиск по всем сервисам SuperApp)..."
                  className="flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-muted outline-none"
                />
                <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-txt-muted bg-surface-3 rounded border border-bdr-subtle">
                  ESC
                </kbd>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-bdr-subtle bg-surface-1/60 overflow-x-auto no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors',
                      activeCategory === cat.id
                        ? 'bg-dv-gold/20 text-dv-gold border border-dv-gold/30'
                        : 'text-txt-muted hover:text-txt-primary hover:bg-white/5'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Results List */}
              <div className="max-h-[55vh] overflow-y-auto py-2">
                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-center space-y-2">
                    <p className="text-sm text-txt-muted">{t('platform.command_empty')}</p>
                    {query.trim() && (
                      <button
                        onClick={() => {
                          onAIQuery?.(query)
                          onClose()
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dv-gold/15 text-dv-gold text-xs font-semibold hover:bg-dv-gold/25 transition-colors"
                      >
                        <Sparkles size={14} />
                        <span>Спросить у Jarvis AI: "{query}"</span>
                      </button>
                    )}
                  </div>
                )}

                {Array.from(sections.entries()).map(([section, items]) => (
                  <div key={section}>
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-txt-ghost uppercase tracking-wider">{section}</p>
                    {items.map((cmd) => {
                      const idx = filtered.indexOf(cmd)
                      const isSelected = idx === selectedIndex
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                          )}
                        >
                          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isSelected ? 'bg-dv-gold/15 text-dv-gold' : 'bg-surface-3 text-txt-muted')}>
                            {cmd.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium truncate', isSelected ? 'text-txt-primary' : 'text-txt-secondary')}>{cmd.label}</p>
                            {cmd.description && <p className="text-xs text-txt-muted truncate">{cmd.description}</p>}
                          </div>
                          <ArrowRight size={14} className={cn('shrink-0 transition-opacity', isSelected ? 'opacity-100 text-dv-gold' : 'opacity-0')} />
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Navigation Hints Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-bdr-subtle text-[10px] text-txt-ghost bg-surface-2/30">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-3 rounded border border-bdr-subtle">↑↓</kbd> Навигация</span>
                  <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-3 rounded border border-bdr-subtle">↵</kbd> Выбор</span>
                </div>
                <span>SuperApp DentVision</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen }
}
