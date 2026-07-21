import { useEffect, useState } from 'react'
import { Wallet, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react'
import * as api from '@/utils/api'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return `${Math.round(n || 0).toLocaleString('ru-RU')} ₸`
}

export function DentWalletCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await api.getDentCashWallet()
        if (!cancelled) setWallet(data)
      } catch {
        if (!cancelled) setWallet(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <Card className={cn('border-dv-gold/25 bg-gradient-to-br from-dv-gold/10 via-white/[0.02] to-transparent', className)}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
              <Wallet size={16} className="text-dv-gold" />
              Dent Wallet
            </div>
            <p className="text-[11px] text-txt-muted mt-1">1 DentCash = 1 ₸ · внутри экосистемы DentVision</p>
          </div>
          <Badge variant="gold" size="xs">DentCash</Badge>
        </div>

        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-dv-gold/30 border-t-dv-gold animate-spin" />
          </div>
        ) : !wallet ? (
          <p className="text-sm text-txt-muted">Не удалось загрузить кошелёк</p>
        ) : (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-txt-muted font-semibold">Баланс</p>
              <p className="text-3xl font-bold text-dv-gold mt-1">{fmt(wallet.balanceTenge)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/[0.03] border border-bdr-subtle p-2.5">
                <p className="text-[10px] text-txt-muted flex items-center gap-1"><Clock size={10} /> Ожидает</p>
                <p className="text-sm font-semibold text-txt-primary mt-1">{fmt(wallet.pendingTenge)}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-bdr-subtle p-2.5">
                <p className="text-[10px] text-txt-muted flex items-center gap-1"><ArrowDownLeft size={10} /> За месяц</p>
                <p className="text-sm font-semibold text-emerald-300 mt-1">+{fmt(wallet.earnedThisMonthTenge)}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-bdr-subtle p-2.5">
                <p className="text-[10px] text-txt-muted flex items-center gap-1"><ArrowUpRight size={10} /> Потрачено</p>
                <p className="text-sm font-semibold text-amber-200 mt-1">−{fmt(wallet.spentThisMonthTenge)}</p>
              </div>
            </div>
            {(wallet.recent || []).length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-bdr-subtle">
                <p className="text-[10px] uppercase tracking-wider text-txt-muted font-semibold">Последние операции</p>
                {(wallet.recent as any[]).slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-txt-secondary truncate">
                      {tx.type === 'earn' ? 'Кэшбэк' : tx.type === 'spend' ? 'Списание' : tx.type}
                      {tx.status === 'pending' ? ' · ожидает' : ''}
                    </span>
                    <span className={cn(
                      'font-semibold shrink-0',
                      tx.type === 'spend' || tx.type === 'clawback' ? 'text-amber-200' : 'text-emerald-300',
                    )}>
                      {tx.type === 'spend' || tx.type === 'clawback' ? '−' : '+'}{fmt(tx.amountTenge)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
