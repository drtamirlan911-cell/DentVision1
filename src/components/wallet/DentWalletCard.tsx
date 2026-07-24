import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, ArrowDownLeft, ArrowUpRight, Clock, Gift, ShoppingBag } from 'lucide-react'
import * as api from '@/utils/api'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return `${Math.round(n || 0).toLocaleString('ru-RU')} ₸`
}

export function DentWalletCard({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDentCashWallet()
      setWallet(data)
    } catch (e: any) {
      setWallet(null)
      setError(e?.message || 'Не удалось загрузить кошелёк')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Card className={cn('border-dv-gold/25 bg-gradient-to-br from-dv-gold/10 via-white/[0.02] to-transparent overflow-hidden', className)}>
      <CardContent className="p-3 sm:p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
              <Gift size={16} className="text-dv-gold shrink-0" />
              <span className="truncate">Кэшбэк DentCash</span>
            </div>
            <p className="text-[11px] text-txt-muted mt-1 leading-snug">
              1 DentCash = 1 ₸ · копится с покупок в магазине и подписки
            </p>
          </div>
          <Badge variant="gold" size="xs" className="shrink-0 self-start">Dent Wallet</Badge>
        </div>

        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-dv-gold/30 border-t-dv-gold animate-spin" />
          </div>
        ) : error || !wallet ? (
          <div className="space-y-2">
            <p className="text-sm text-txt-muted">{error || 'Не удалось загрузить кошелёк'}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()}>Повторить</Button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-txt-muted font-semibold">Доступно к списанию</p>
              <p className="text-2xl sm:text-3xl font-bold text-dv-gold mt-1 break-all">{fmt(wallet.balanceTenge)}</p>
              {Number(wallet.balanceTenge || 0) === 0 && (
                <p className="text-[11px] text-txt-muted mt-1.5 leading-relaxed">
                  Пока 0 ₸ — сделайте заказ в маркетплейсе: кэшбэк 1–7% начислится после доставки.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            {(wallet.recent || []).length > 0 ? (
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
            ) : (
              <div className="rounded-xl border border-dashed border-dv-gold/25 bg-dv-gold/5 px-3 py-2.5">
                <p className="text-[11px] text-txt-secondary leading-relaxed">
                  История пуста. Купите в магазине или оплатите подписку — кэшбэк появится здесь.
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                icon={<ShoppingBag size={14} />}
                onClick={() => navigate('/shop')}
              >
                В магазин
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                icon={<Wallet size={14} />}
                onClick={() => navigate('/shop/checkout')}
              >
                Списать в заказе
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
