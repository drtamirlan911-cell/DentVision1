import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, DollarSign, Calendar, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { PageHeader, StatCard } from '@/components/ui/ds/StatCard'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useAuth } from '@/store/auth.store'
import { useDataQuery } from '@/queries/useDataQuery'
import * as api from '@/utils/api'
import type { Receipt } from '@/types'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export default function Analytics() {
  const { user, clinic: authClinic } = useAuth()
  const clinicId = authClinic?.id || user?.clinicId || ''
  const data = useDataQuery(clinicId || undefined)

  const patients = Array.isArray(data.patients) ? data.patients : []
  const appointments = useMemo(() => Array.isArray(data.appointments) ? data.appointments : [], [data.appointments])
  const receipts: Receipt[] = Array.isArray(data.receipts) ? data.receipts : []

  const totalRevenue = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthRevenue = receipts
    .filter((r) => (r.date || '').startsWith(thisMonth))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const loadByDay = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    for (const a of appointments as any[]) {
      const raw = a.date || a.appointmentDate || a.start || a.createdAt
      if (!raw) continue
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) continue
      counts[d.getDay()] += 1
    }
    // Display Mon→Sun
    return [1, 2, 3, 4, 5, 6, 0].map((idx) => ({
      label: DAY_LABELS[idx],
      count: counts[idx],
    }))
  }, [appointments])

  const maxLoad = Math.max(1, ...loadByDay.map((d) => d.count))
  const hasData = patients.length + appointments.length + receipts.length > 0

  const funnelQuery = useQuery({
    queryKey: ['presentationFunnel', clinicId],
    queryFn: () => api.getPresentationFunnel(),
    enabled: Boolean(clinicId),
  })
  const funnelStages = funnelQuery.data ?? []
  const funnelMax = Math.max(1, ...funnelStages.map((s) => s.count))

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-full overflow-x-hidden mx-auto space-y-6 p-4 md:p-6">
      <motion.div variants={item}>
        <PageHeader
          title="Аналитика"
          subtitle="Реальные метрики клиники · Finance AI может разобрать детали в чате"
          icon={<BarChart3 size={20} />}
        />
      </motion.div>

      {!hasData ? (
        <EmptyState
          title="Пока нет данных"
          description="Как только появятся пациенты, записи и оплаты — здесь будут реальные графики."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'Всего пациентов', value: patients.length, icon: <Users size={18} /> },
              { label: 'Записей', value: appointments.length, icon: <Calendar size={18} /> },
              { label: 'Доход за месяц', value: `${(monthRevenue / 1000).toFixed(0)}K ₸`, icon: <DollarSign size={18} /> },
              { label: 'Общий доход', value: `${(totalRevenue / 1000).toFixed(0)}K ₸`, icon: <TrendingUp size={18} /> },
            ].map((stat) => (
              <motion.div key={stat.label} variants={item}>
                <StatCard label={stat.label} value={stat.value} icon={stat.icon} />
              </motion.div>
            ))}
          </div>

          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle>Загрузка по дням недели</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-40">
                  {loadByDay.map((day) => {
                    const height = Math.max(8, (day.count / maxLoad) * 100)
                    return (
                      <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-txt-muted">{day.count || ''}</span>
                        <div
                          className="w-full rounded-t-md bg-dv-gold/30 border-t border-dv-gold/40 transition-all duration-500"
                          style={{ height: `${height}%` }}
                          title={`${day.count} записей`}
                        />
                        <span className="text-2xs text-txt-muted">{day.label}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Independent of `hasData`: a clinic can have approved presentation
          releases — the thing this card is actually about — while showing
          zero patients/appointments/receipts by this page's own definition
          of "data", and the reverse is just as possible. */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-dv-gold" />
              Воронка презентаций
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelQuery.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
            ) : funnelStages.length === 0 || funnelStages.every((s) => s.count === 0) ? (
              <p className="text-xs text-txt-muted">Пока нет утверждённых планов лечения.</p>
            ) : (
              <div className="space-y-2.5">
                {funnelStages.map((s) => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs text-txt-muted">{s.label}</span>
                    <div className="flex-1 h-6 rounded-md bg-white/[0.03] overflow-hidden">
                      <div
                        className="h-full rounded-md bg-dv-gold/30 border-r border-dv-gold/50 transition-all duration-500"
                        style={{ width: `${(s.count / funnelMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-medium text-txt-primary">{s.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
