import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, Calendar, Users, ShoppingCart, GraduationCap, BarChart3, Bot, FileText, Settings, Stethoscope, Package, CreditCard, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

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
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const commands: CommandItem[] = useMemo(() => [
    { id: 'schedule', label: 'Расписание', description: 'Открыть календарь записей', icon: <Calendar size={16} />, action: () => { navigate('/crm/schedule'); onClose() }, section: 'CRM', keywords: ['расписание', 'календарь', 'записи', 'appointment'] },
    { id: 'patients', label: 'Пациенты', description: 'Список пациентов', icon: <Users size={16} />, action: () => { navigate('/crm/patients'); onClose() }, section: 'CRM', keywords: ['пациенты', 'список', 'patient'] },
    { id: 'cashier', label: 'Касса', description: 'Финансы и счета', icon: <CreditCard size={16} />, action: () => { navigate('/crm/cashier'); onClose() }, section: 'CRM', keywords: ['касса', 'оплата', 'счёт', 'cashier', 'finance'] },
    { id: 'inventory', label: 'Склад', description: 'Учёт материалов', icon: <Package size={16} />, action: () => { navigate('/crm/inventory'); onClose() }, section: 'CRM', keywords: ['склад', 'материалы', 'inventory', 'stock'] },
    { id: 'lab', label: 'Лаборатория', description: 'Лабораторные заказы', icon: <Stethoscope size={16} />, action: () => { navigate('/crm/lab'); onClose() }, section: 'CRM', keywords: ['лаборатория', 'lab', 'заказ'] },
    { id: 'documents', label: 'Документы', description: 'Файлы и подписи', icon: <FileText size={16} />, action: () => { navigate('/crm/documents'); onClose() }, section: 'CRM', keywords: ['документы', 'файлы', 'documents'] },
    { id: 'promotions', label: 'Акции', description: 'Скидки и спецпредложения', icon: <Stethoscope size={16} />, action: () => { navigate('/crm/promotions'); onClose() }, section: 'CRM', keywords: ['акции', 'скидки', 'promotions'] },
    { id: 'icd10', label: 'МКБ-10', description: 'Справочник диагнозов', icon: <FileText size={16} />, action: () => { navigate('/crm/icd10'); onClose() }, section: 'CRM', keywords: ['мкб', 'icd10', 'диагноз'] },
    { id: 'staff', label: 'Сотрудники', description: 'Команда клиники', icon: <Users size={16} />, action: () => { navigate('/crm/staff'); onClose() }, section: 'CRM', keywords: ['сотрудники', 'staff', 'врачи'] },
    { id: 'reminders', label: 'Напоминания', description: 'SMS и WhatsApp', icon: <Calendar size={16} />, action: () => { navigate('/crm/reminders'); onClose() }, section: 'CRM', keywords: ['напоминания', 'reminders'] },
    { id: 'shop', label: 'Маркетплейс', description: 'Товары и закупки', icon: <ShoppingCart size={16} />, action: () => { navigate('/shop'); onClose() }, section: 'Сервисы', keywords: ['магазин', 'товары', 'shop', 'marketplace'] },
    { id: 'school', label: 'Академия', description: 'Курсы и обучение', icon: <GraduationCap size={16} />, action: () => { navigate('/school'); onClose() }, section: 'Сервисы', keywords: ['школа', 'курсы', 'school', 'academy'] },
    { id: 'analytics', label: 'Аналитика', description: 'Отчёты и метрики', icon: <BarChart3 size={16} />, action: () => { navigate('/analytics'); onClose() }, section: 'Сервисы', keywords: ['аналитика', 'отчёты', 'analytics'] },
    { id: 'settings', label: 'Настройки', description: 'Параметры системы', icon: <Settings size={16} />, action: () => { navigate('/settings'); onClose() }, section: 'Платформа', keywords: ['настройки', 'settings'] },
    { id: 'ai-chat', label: 'AI Ассистент', description: 'Начать диалог с AI', icon: <Bot size={16} />, action: () => { navigate('/'); onClose() }, section: 'Платформа', keywords: ['ai', 'ассистент', 'помощь', 'умный'] },
  ], [navigate, onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q))
    )
  }, [query, commands])

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
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

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
        if (query.trim() && filtered.length === 0) {
          onAIQuery?.(query)
          onClose()
        } else {
          filtered[selectedIndex].action()
        }
      } else if (query.trim()) {
        onAIQuery?.(query)
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [filtered, selectedIndex, query, onAIQuery, onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const flatIndex = 0

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
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-lg mx-4 bg-surface-1 border border-bdr-subtle rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-bdr-subtle">
                <Search size={18} className="text-txt-muted shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Команда или запрос..."
                  className="flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-muted outline-none"
                />
                <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-txt-muted bg-surface-3 rounded border border-bdr-subtle">
                  ESC
                </kbd>
              </div>

              <div className="max-h-[50vh] overflow-y-auto py-2">
                {filtered.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-txt-muted">Ничего не найдено</p>
                    <p className="text-xs text-txt-ghost mt-1">Нажмите Enter для отправки AI-запроса</p>
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

              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-bdr-subtle text-[10px] text-txt-ghost">
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-3 rounded border border-bdr-subtle">↑↓</kbd> навигация</span>
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-3 rounded border border-bdr-subtle">↵</kbd> выбрать</span>
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-3 rounded border border-bdr-subtle">ESC</kbd> закрыть</span>
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
