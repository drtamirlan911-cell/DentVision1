import React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, DollarSign, Calendar, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/hooks/useData'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function Analytics() {
  const { user } = useAuth()
  const data = useData(user?.clinicId)

  const patients = data.patients || []
  const appointments = data.appointments || []
  const receipts = data.receipts || []

  const totalRevenue = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthRevenue = receipts
    .filter((r) => (r.date || '').startsWith(thisMonth))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-6xl mx-auto space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Аналитика"
          subtitle="Обзор ключевых метрик клиники"
          icon={<BarChart3 size={20} />}
        />
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего пациентов', value: patients.length, icon: <Users size={18} />, color: '#C9A96E' },
          { label: 'Записей', value: appointments.length, icon: <Calendar size={18} />, color: '#2980B9' },
          { label: 'Доход за месяц', value: `${(monthRevenue / 1000).toFixed(0)}K ₸`, icon: <DollarSign size={18} />, color: '#27AE60' },
          { label: 'Общий доход', value: `${(totalRevenue / 1000).toFixed(0)}K ₸`, icon: <TrendingUp size={18} />, color: '#8E44AD' },
        ].map((stat, i) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${stat.color}15`, color: stat.color }}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-txt-primary">{stat.value}</p>
              <p className="text-xs text-txt-muted mt-1">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Загрузка по дням</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, i) => {
                const height = Math.max(20, Math.random() * 100)
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md bg-dv-gold/20 transition-all duration-500"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-2xs text-txt-muted">{day}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
