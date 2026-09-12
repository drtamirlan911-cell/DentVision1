import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'
import { API_URL } from '@/utils/apiOrigin'
import { getAccessToken } from '@/utils/api'
import { Button } from '@/components/ui/ds/Button'
import { Card, CardContent } from '@/components/ui/ds/Card'

interface VerticalRow {
  vertical: string
  operations: number
  grossMinor: string | number
  commissionMinor: string | number
  contributionMarginMinor: string | number
  takeRateBps: number
  marginBps: number
  lossCount: number
  lowMarginCount: number
  status: string
}

interface EconomicsData {
  totals?: {
    operations: number
    grossMinor: string | number
    commissionMinor: string | number
    contributionMarginMinor: string | number
    takeRateBps: number
    marginBps: number
  }
  byVertical?: VerticalRow[]
  rules?: unknown
}

function moneyMinor(value: string | number | undefined): string {
  const n = Number(value || 0) / 100
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸`
}

function pctBps(value: number | undefined): string {
  return `${((Number(value || 0)) / 100).toFixed(2)}%`
}

function verticalLabel(value: string): string {
  return ({
    DIAGNOSTIC_3D: 'Диагностика 3D',
    MEDICAL_ANALYSIS: 'Медицинские анализы',
    DENTAL_LAB: 'Зуботехнические лаборатории',
  } as Record<string, string>)[value] || value
}

function statusLabel(value: string): string {
  return ({ HEALTHY: 'В норме', LOW_MARGIN: 'Низкая маржа', LOSS: 'Убыток' } as Record<string, string>)[value] || value
}

export default function PartnerEconomicsPanel() {
  const [data, setData] = useState<EconomicsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_URL}/api/bi/partner-economics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'Не удалось загрузить economics')
      setData(body?.data || body || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const totals = data?.totals
  const rows = Array.isArray(data?.byVertical) ? data!.byVertical! : []

  return (
    <Card className="border-dv-gold/15">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold">
              <ShieldCheck size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Partner Economics</h3>
              <p className="text-[11px] text-txt-muted mt-0.5">Канонический ledger · текущие правила · вклад платформы</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" className="min-h-9" onClick={() => void load()} disabled={loading} icon={<RefreshCw size={13} />}>
            Обновить
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        ) : loading && !data ? (
          <p className="text-xs text-txt-muted py-6 text-center">Загрузка экономики…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <Metric label="Операции" value={String(totals?.operations || 0)} />
              <Metric label="GMV" value={moneyMinor(totals?.grossMinor)} />
              <Metric label="Комиссия" value={moneyMinor(totals?.commissionMinor)} />
              <Metric label="Вклад" value={moneyMinor(totals?.contributionMarginMinor)} />
              <Metric label="Take rate" value={pctBps(totals?.takeRateBps)} />
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-txt-muted py-4">В ledger пока нет операций.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.vertical} className="rounded-lg border border-white/[0.06] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-txt-primary">{verticalLabel(row.vertical)}</p>
                        <p className="text-[10px] text-txt-muted mt-0.5">{row.operations} операций · комиссия {moneyMinor(row.commissionMinor)}</p>
                      </div>
                      <span className={`text-[10px] font-medium ${row.status === 'LOSS' ? 'text-red-400' : row.status === 'LOW_MARGIN' ? 'text-yellow-400' : 'text-green-400'}`}>
                        {statusLabel(row.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
                      <Mini label="GMV" value={moneyMinor(row.grossMinor)} />
                      <Mini label="Вклад" value={moneyMinor(row.contributionMarginMinor)} />
                      <Mini label="Take rate" value={pctBps(row.takeRateBps)} />
                      <Mini label="Маржа" value={pctBps(row.marginBps)} />
                    </div>
                    {(row.lossCount > 0 || row.lowMarginCount > 0) && (
                      <p className="text-[10px] text-yellow-400 mt-2">
                        {row.lossCount > 0 ? `Убыточных: ${row.lossCount}` : ''}{row.lossCount > 0 && row.lowMarginCount > 0 ? ' · ' : ''}{row.lowMarginCount > 0 ? `Низкая маржа: ${row.lowMarginCount}` : ''}
                      </p>
                    )}
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

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/[0.05] px-2 py-2 text-center"><p className="text-sm font-semibold text-txt-primary">{value}</p><p className="text-[10px] text-txt-muted">{label}</p></div>
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-txt-primary">{value}</p><p className="text-[9px] text-txt-muted">{label}</p></div>
}
