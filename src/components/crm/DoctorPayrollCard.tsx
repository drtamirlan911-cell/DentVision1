import React, { useEffect, useMemo, useState } from 'react'
import { Wallet, ChevronDown, ChevronUp, Calendar, User } from 'lucide-react'
import * as api from '@/utils/api'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { cn } from '@/lib/utils'

function monthRange(): { from: string; to: string; label: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const label = from.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    label,
  }
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₸`
}

interface DoctorPayrollCardProps {
  className?: string
  refreshKey?: number
}

export function DoctorPayrollCard({ className, refreshKey = 0 }: DoctorPayrollCardProps) {
  const period = useMemo(() => monthRange(), [])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [payload, setPayload] = useState<api.DoctorPayrollPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await api.getMyPayroll({ from: period.from, to: period.to })
        if (!cancelled) setPayload(data)
      } catch {
        if (!cancelled) setPayload(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [period.from, period.to, refreshKey])

  const payroll = payload?.payroll

  return (
    <Card className={cn('border-dv-gold/20 bg-gradient-to-br from-dv-gold/10 to-transparent', className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
              <Wallet size={16} className="text-dv-gold" />
              Моя зарплата
            </div>
            <p className="text-xs text-txt-muted mt-1 capitalize">{period.label}</p>
          </div>
          {payroll && (
            <Badge variant="gold" size="xs">{payroll.percent}%</Badge>
          )}
        </div>

        {loading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-dv-gold/30 border-t-dv-gold animate-spin" />
          </div>
        ) : !payroll ? (
          <p className="text-sm text-txt-muted">Не удалось загрузить начисления</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] text-txt-muted">К выплате</p>
                <p className="text-xl font-bold text-dv-gold">{formatMoney(payroll.earned)}</p>
              </div>
              <div>
                <p className="text-[11px] text-txt-muted">Закрытых приёмов</p>
                <p className="text-lg font-semibold text-txt-primary">{payroll.visits}</p>
              </div>
              <div>
                <p className="text-[11px] text-txt-muted">Валово</p>
                <p className="text-sm font-medium text-txt-secondary">{formatMoney(payroll.gross)}</p>
              </div>
              <div>
                <p className="text-[11px] text-txt-muted">Материалы</p>
                <p className="text-sm font-medium text-txt-secondary">{formatMoney(payroll.matCost)}</p>
              </div>
            </div>

            <p className="text-[11px] text-txt-muted">
              Начисление = (сумма услуг − материалы) × {payroll.percent}% по закрытым приёмам.
            </p>

            {payroll.visitDetails.length > 0 && (
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => setExpanded((v) => !v)}
                  icon={expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                >
                  Детализация по приёмам ({payroll.visitDetails.length})
                </Button>

                {expanded && (
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                    {payroll.visitDetails.map((visit) => (
                      <div
                        key={visit.appointmentId}
                        className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 text-xs text-txt-secondary">
                            <Calendar size={12} />
                            {visit.date}
                            {visit.time ? ` · ${visit.time}` : ''}
                          </div>
                          <span className="text-sm font-semibold text-dv-gold">{formatMoney(visit.earned)}</span>
                        </div>
                        {visit.patientName && (
                          <div className="flex items-center gap-1.5 text-xs text-txt-muted">
                            <User size={12} />
                            {visit.patientName}
                          </div>
                        )}
                        <div className="space-y-1">
                          {visit.services.map((service, idx) => (
                            <div key={idx} className="flex justify-between gap-2 text-xs">
                              <span className="text-txt-secondary">{service.name}</span>
                              <span className="text-txt-muted shrink-0">{formatMoney(service.price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {payroll.visitDetails.length === 0 && (
              <p className="text-sm text-txt-muted">
                Закройте приёмы с услугами и ценами — начисление появится здесь автоматически.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
