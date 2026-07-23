import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle } from 'lucide-react'
import { StatCard } from '@/components/ui/ds/StatCard'

interface Props {
  money: (n: number) => string
  revenue: number
  expenses: number
  payroll: number
  profit: number
  debts: number
  loading?: boolean
}

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

export function FinancePnLStrip({ money, revenue, expenses, payroll, profit, debts, loading }: Props) {
  return (
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <StatCard
          label="Выручка"
          value={loading ? '…' : money(revenue)}
          icon={<TrendingUp size={18} />}
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <StatCard
          label="Расходы"
          value={loading ? '…' : money(expenses)}
          icon={<TrendingDown size={18} />}
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <StatCard
          label="ФОТ"
          value={loading ? '…' : money(payroll)}
          icon={<Wallet size={18} />}
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <StatCard
          label="Прибыль"
          value={loading ? '…' : money(profit)}
          icon={<PiggyBank size={18} />}
          className={profit < 0 ? 'ring-1 ring-error/30' : profit > 0 ? 'ring-1 ring-success/20' : undefined}
        />
      </motion.div>
      <motion.div variants={fadeUp} className="col-span-2 lg:col-span-1">
        <StatCard
          label="Долги"
          value={loading ? '…' : money(debts)}
          icon={<AlertTriangle size={18} />}
          className={debts > 0 ? 'ring-1 ring-warning/30' : undefined}
        />
      </motion.div>
    </motion.div>
  )
}
