import React, { useMemo } from 'react'
import { Plus, Receipt, Trash2, Download } from 'lucide-react'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { downloadCsv } from '@/lib/financePeriod'
import { fd } from '@/utils/constants'
import type { Expense } from '@/types'

interface Props {
  expenses: Expense[]
  money: (n: number) => string
  periodFrom: string
  periodTo: string
  onAdd: () => void
  onDelete: (id: string) => void
}

export function FinanceExpensesPanel({
  expenses,
  money,
  periodFrom,
  periodTo,
  onAdd,
  onDelete,
}: Props) {
  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        const d = (e.date || '').slice(0, 10)
        return d >= periodFrom && d <= periodTo
      }),
    [expenses, periodFrom, periodTo],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of filtered) {
      const cat = e.category || 'Прочее'
      map.set(cat, (map.get(cat) || 0) + (Number(e.amount) || 0))
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  const total = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const exportCsv = () => {
    downloadCsv(
      `expenses-${periodFrom}_${periodTo}.csv`,
      ['Дата', 'Категория', 'Сумма', 'Комментарий'],
      filtered.map((e) => [e.date, e.category, e.amount, e.notes || '']),
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-txt-primary">Расходы клиники</p>
          <p className="text-xs text-txt-muted mt-0.5">Аренда, материалы, маркетинг, авансы ФОТ</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="error" size="sm">Итого −{money(total)}</Badge>
          <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={exportCsv} disabled={!filtered.length}>
            CSV
          </Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={onAdd}>
            Расход
          </Button>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {byCategory.map(([cat, amount]) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-bdr-subtle bg-white/[0.02]"
            >
              <span className="text-txt-muted">{cat}</span>
              <span className="font-semibold text-error">−{money(amount)}</span>
            </span>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt size={32} />}
          title="Нет расходов за период"
          description="Добавьте расход — он попадёт в P&L"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-bdr-subtle bg-white/[0.02]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-txt-primary truncate">{exp.category}</p>
                <p className="text-xs text-txt-muted">
                  {fd(exp.date || '')}
                  {exp.notes ? ` · ${exp.notes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-base font-bold text-error">−{money(Number(exp.amount) || 0)}</span>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-txt-muted hover:text-error hover:bg-error/10 transition-colors"
                  title="Удалить"
                  onClick={() => {
                    if (window.confirm('Удалить расход?')) onDelete(exp.id)
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
