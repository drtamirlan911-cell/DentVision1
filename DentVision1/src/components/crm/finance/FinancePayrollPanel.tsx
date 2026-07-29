import React, { useState } from 'react'
import { Wallet, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { downloadCsv, payTypeLabel } from '@/lib/financePeriod'

export interface PayrollRow {
  userId?: string
  name: string
  role?: string
  percent?: number
  payType?: string
  baseSalary?: number
  salaryPart?: number
  commissionPart?: number
  visits?: number
  gross?: number
  matCost?: number
  net?: number
  earned: number
}

interface Props {
  rows: PayrollRow[]
  money: (n: number) => string
  loading?: boolean
  periodLabel: string
}

export function FinancePayrollPanel({ rows, money, loading, periodLabel }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const total = rows.reduce((s, r) => s + (Number(r.earned) || 0), 0)

  const exportCsv = () => {
    downloadCsv(
      `payroll-${periodLabel}.csv`,
      ['Сотрудник', 'Роль', 'Тип', '%', 'Оклад части', 'Комиссия', 'Приёмы', 'Валово', 'Материалы', 'К выплате'],
      rows.map((r) => [
        r.name,
        r.role || '',
        payTypeLabel(r.payType),
        r.percent ?? '',
        r.salaryPart ?? 0,
        r.commissionPart ?? 0,
        r.visits ?? 0,
        r.gross ?? 0,
        r.matCost ?? 0,
        r.earned,
      ]),
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 rounded-full border-2 border-dv-gold/30 border-t-dv-gold animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-txt-primary">Зарплата и начисления</p>
          <p className="text-xs text-txt-muted mt-0.5">
            Оклад (пропорция периода) + % от (услуги − материалы) по закрытым приёмам · {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="gold" size="sm">Итого {money(total)}</Badge>
          <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={exportCsv} disabled={!rows.length}>
            CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet size={32} />}
          title="Нет начислений"
          description="Укажите оклад / % сотрудникам и закройте приёмы с услугами"
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((emp, i) => {
            const key = emp.userId || `${emp.name}-${i}`
            const open = openId === key
            return (
              <div key={key} className="rounded-xl border border-bdr-subtle bg-white/[0.02] overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setOpenId(open ? null : key)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-txt-primary truncate">{emp.name}</p>
                    <p className="text-xs text-txt-muted mt-0.5">
                      {emp.role || 'Сотрудник'} · {payTypeLabel(emp.payType)}
                      {emp.payType !== 'salary' ? ` · ${emp.percent ?? 30}%` : ''}
                      {emp.visits != null ? ` · ${emp.visits} приём.` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-dv-gold">{money(emp.earned)}</p>
                      <p className="text-2xs text-txt-muted">к выплате</p>
                    </div>
                    {open ? <ChevronUp size={16} className="text-txt-muted" /> : <ChevronDown size={16} className="text-txt-muted" />}
                  </div>
                </button>
                {open && (
                  <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-bdr-subtle pt-3">
                    <div>
                      <p className="text-2xs text-txt-muted">Оклад (часть)</p>
                      <p className="text-sm font-semibold text-txt-primary">{money(emp.salaryPart || 0)}</p>
                    </div>
                    <div>
                      <p className="text-2xs text-txt-muted">Комиссия</p>
                      <p className="text-sm font-semibold text-txt-primary">{money(emp.commissionPart || 0)}</p>
                    </div>
                    <div>
                      <p className="text-2xs text-txt-muted">Валово</p>
                      <p className="text-sm font-semibold text-txt-primary">{money(emp.gross || 0)}</p>
                    </div>
                    <div>
                      <p className="text-2xs text-txt-muted">Материалы</p>
                      <p className="text-sm font-semibold text-txt-primary">{money(emp.matCost || 0)}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
