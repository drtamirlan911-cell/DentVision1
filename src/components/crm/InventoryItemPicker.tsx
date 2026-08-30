import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Package, ShoppingCart, BookOpen, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/ds/Input'
import { cn } from '@/lib/utils'
import * as api from '@/utils/api'
import type { InventorySuggestion } from '@/utils/api'

const SOURCE_META: Record<InventorySuggestion['source'], { label: string; icon: React.ReactNode; hint: string }> = {
  clinic: { label: 'Уже на складе', icon: <Package size={13} />, hint: 'Позиция есть — лучше пополнить её, а не заводить вторую' },
  shop: { label: 'В маркетплейсе', icon: <ShoppingCart size={13} />, hint: 'Товар можно заказать у продавца' },
  preset: { label: 'Пресет', icon: <Sparkles size={13} />, hint: 'Готовая карточка товара' },
  catalog: { label: 'Справочник', icon: <BookOpen size={13} />, hint: 'Типовой расходник' },
}

interface Props {
  /** Текущее название в форме. */
  value: string
  onChange: (name: string) => void
  /** Выбор подсказки — заполняет остальные поля формы. */
  onPick: (s: InventorySuggestion) => void
  /** Открыть уже существующую позицию вместо создания дубликата. */
  onOpenExisting?: (itemId: string) => void
  label?: string
  autoFocus?: boolean
  disabled?: boolean
}

/**
 * Поиск товара при добавлении позиции на склад.
 *
 * Раньше название вводили в пустое поле руками, а категорию и единицу
 * выбирали отдельно — четыре действия там, где хватает одного. Подсказки
 * приходят из четырёх источников сразу: свой склад, товары маркетплейса,
 * пресеты и встроенный справочник расходников.
 */
export function InventoryItemPicker({
  value, onChange, onPick, onOpenExisting, label = 'Название *', autoFocus, disabled,
}: Props) {
  const [suggestions, setSuggestions] = useState<InventorySuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  /** Выбор подсказки меняет `value`; без этого флага он тут же запустил бы новый поиск. */
  const skipNextSearch = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    let cancelled = false
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const rows = await api.getInventorySuggestions(value, 12)
        if (!cancelled) {
          setSuggestions(rows)
          setActive(0)
        }
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [value])

  // Клик мимо закрывает список — иначе он перекрывает поля формы под собой.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const visible = useMemo(() => suggestions.slice(0, 12), [suggestions])

  const choose = (s: InventorySuggestion) => {
    skipNextSearch.current = true
    onPick(s)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || visible.length === 0) {
      if (e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % visible.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + visible.length) % visible.length)
    } else if (e.key === 'Enter') {
      // Форму не отправляем: Enter в открытом списке выбирает подсказку.
      e.preventDefault()
      choose(visible[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        label={label}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        icon={<Search size={16} />}
        placeholder="Начните вводить: перчатки, композит, боры…"
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="min-h-11"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open && (loading || visible.length > 0) && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-bdr-subtle bg-surface-2 shadow-lg"
        >
          {loading && visible.length === 0 && (
            <p className="px-3 py-3 text-xs text-txt-muted">Ищем…</p>
          )}
          {visible.map((s, idx) => {
            const meta = SOURCE_META[s.source]
            return (
              <button
                key={s.key}
                type="button"
                role="option"
                aria-selected={idx === active}
                onMouseEnter={() => setActive(idx)}
                onClick={() => choose(s)}
                className={cn(
                  'w-full text-left px-3 py-2 border-b border-bdr-subtle last:border-b-0 transition-colors',
                  idx === active ? 'bg-surface-3' : 'hover:bg-surface-3',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-txt-primary">{s.name}</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-2xs text-txt-muted">
                    {meta.icon}{meta.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-2xs text-txt-muted">
                  {s.category && <span>{s.category}</span>}
                  {s.unit && <span>· {s.unit}</span>}
                  {s.price ? <span>· ≈ {s.price.toLocaleString('ru-RU')} ₸</span> : null}
                  {s.supplier && <span>· {s.supplier}</span>}
                  {s.stock != null && s.stock > 0 && <span className="text-success">· в наличии {s.stock}</span>}
                </div>
                {s.existingItemId && (
                  <p className="mt-1 text-2xs text-warning">
                    Уже на складе: {s.existingQuantity ?? 0} — выбор пополнит эту позицию
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Позиция с таким названием уже заведена — предлагаем открыть её. */}
      {!open && onOpenExisting && (() => {
        const exact = suggestions.find(
          (s) => s.source === 'clinic' && s.name.trim().toLowerCase() === value.trim().toLowerCase(),
        )
        if (!exact || !value.trim()) return null
        return (
          <button
            type="button"
            onClick={() => onOpenExisting(exact.key.replace('clinic:', ''))}
            className="mt-1 text-2xs text-dv-gold underline underline-offset-2"
          >
            Такая позиция уже есть — открыть её
          </button>
        )
      })()}
    </div>
  )
}
