import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { motion } from 'framer-motion'
import * as api from '@/utils/api'
import { useAuth } from '@/store/auth.store'

/** Compact header chip: opens Profile wallet / cashback. Icon-first on narrow screens. */
export function DentCashHeaderChip() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setBalance(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.getDentCashWallet()
        if (!cancelled) setBalance(Number(data?.balanceTenge || 0))
      } catch {
        if (!cancelled) setBalance(null)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, user?.id])

  if (!isAuthenticated || !user) return null

  const label =
    balance == null
      ? 'Кэшбэк'
      : `${Math.round(balance).toLocaleString('ru-RU')} ₸`

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate('/profile')}
      title={`Кэшбэк DentCash · ${label}`}
      className="flex items-center gap-1 max-w-[7.5rem] px-1.5 sm:px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 hover:bg-emerald-400/15 transition-colors shrink-0"
    >
      <Gift size={12} className="shrink-0" />
      <span className="text-[10px] font-semibold truncate tabular-nums">
        {balance == null ? (
          <span className="hidden sm:inline">Кэшбэк</span>
        ) : (
          <>
            <span className="sm:hidden">{Math.round(balance)}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        )}
      </span>
    </motion.button>
  )
}
