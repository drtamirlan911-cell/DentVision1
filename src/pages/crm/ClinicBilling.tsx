/**
 * CRM → Тариф и оплата
 * Self-serve clinic SaaS: trial, plan picker, QR payment.
 * Paid plans activate only after provider webhook confirms payment.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CreditCard, Check, Zap, Crown, Star, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useAuth, canManageClinicSettings } from '@/store/auth.store'
import { useToast } from '@/components/ui/ds/Toast'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { PaymentQrPanel } from '@/components/payments/PaymentQrPanel'
import { extractPaymentQrUrl } from '@/utils/paymentQr'
import * as api from '@/utils/api'

const PLAN_ICON: Record<string, React.ReactNode> = {
  starter: <Star size={18} className="text-txt-muted" />,
  professional: <Zap size={18} className="text-dv-gold" />,
  enterprise: <Crown size={18} className="text-purple-400" />,
}

function fmtMoney(n: number): string {
  return Number(n || 0).toLocaleString('ru-RU') + ' ₸'
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

export default function ClinicBilling() {
  const { user, role, activeMembership } = useAuth()
  const toast = useToast()
  const canManage =
    canManageClinicSettings(role) ||
    canManageClinicSettings(activeMembership?.role) ||
    canManageClinicSettings(user?.role)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [months, setMonths] = useState(1)
  const [pendingPay, setPendingPay] = useState<any>(null)
  const [payStatus, setPayStatus] = useState<string>('pending')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await api.getClinicBilling()
      setData(snap)
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось загрузить подписку')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const checkPayment = useCallback(async (paymentId: string, silent = false) => {
    try {
      const status = await api.getClinicBillingPayment(paymentId)
      const st = String(status?.status || status?.providerStatus || 'pending')
      setPayStatus(st)
      if (status?.activated || st === 'paid') {
        stopPoll()
        setPendingPay(null)
        toast.success('Оплата подтверждена — подписка продлена')
        await load()
        return true
      }
      if (!silent) {
        toast.error('Оплата ещё не поступила. Оплатите QR и подождите подтверждение.')
      }
      return false
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Не удалось проверить оплату')
      return false
    }
  }, [load, stopPoll, toast])

  useEffect(() => {
    if (canManage) void load()
  }, [canManage, load])

  // Auto-poll while awaiting payment
  useEffect(() => {
    stopPoll()
    const paymentId = pendingPay?.payment?.id
    if (!paymentId) return
    setPayStatus('pending')
    pollRef.current = setInterval(() => {
      void checkPayment(paymentId, true)
    }, 5000)
    return stopPoll
  }, [pendingPay?.payment?.id, checkPayment, stopPoll])

  if (!canManage) {
    return <Navigate to="/crm/schedule" replace />
  }

  const checkout = async (planId: string) => {
    setBusy(planId)
    try {
      const res = await api.checkoutClinicBilling(planId, months)
      if (res?.activated) {
        toast.success('Тариф активирован')
        setPendingPay(null)
        await load()
      } else if (res?.payment) {
        const qr = extractPaymentQrUrl(res.payment)
        setPendingPay({
          ...res,
          payment: { ...res.payment, qr: qr || res.payment.qr },
        })
        setPayStatus('pending')
        toast.success(qr ? 'Счёт создан — отсканируйте QR ниже' : 'Счёт создан — завершите оплату ниже')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка оплаты')
    } finally {
      setBusy(null)
    }
  }

  const confirmPay = async () => {
    if (!pendingPay?.payment?.id) return
    setBusy('confirm')
    try {
      // Sync endpoint refuses to activate unpaid invoices (402).
      await api.confirmClinicBilling(pendingPay.payment.id)
      stopPoll()
      setPendingPay(null)
      toast.success('Оплата подтверждена, подписка продлена')
      await load()
    } catch (e: any) {
      // Still poll provider status for clearer UX
      await checkPayment(pendingPay.payment.id, true)
      toast.error(e?.message || 'Оплата не подтверждена')
    } finally {
      setBusy(null)
    }
  }

  const sub = data?.subscription
  const plans: any[] = data?.plans || []
  const currentPlan = String(data?.saasPlan || sub?.plan || 'free')
  const status = String(sub?.status || 'active')

  return (
    <div className="dv-page max-w-5xl mx-auto py-4 md:py-6 space-y-6">
      <PageHeader
        title="Тариф и оплата"
        subtitle="Пробный период, смена тарифа и оплата подписки клиники"
        actions={
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
            Обновить
          </Button>
        }
      />

      {loading && !data ? (
        <p className="text-sm text-txt-muted py-16 text-center">Загрузка…</p>
      ) : (
        <>
          <PlanAccessBanner snap={data} />

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-txt-primary">{data?.clinic?.name || 'Клиника'}</p>
                  <p className="text-xs text-txt-muted mt-1">
                    Текущий план: <span className="text-txt-primary">{currentPlan}</span>
                    {' · '}статус: {status}
                    {' · '}до {fmtDate(sub?.periodEnd)}
                    {data?.daysLeft != null ? ` · осталось ${data.daysLeft} дн.` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {data?.expired && <Badge variant="outline">Истекла / приостановлена</Badge>}
                  {!data?.expired && status === 'trialing' && <Badge variant="gold">Пробный период</Badge>}
                  {!data?.expired && status === 'active' && <Badge variant="success">Активна</Badge>}
                  {data?.expiringSoon && !data?.expired && (
                    <Badge variant="outline">Скоро истечёт</Badge>
                  )}
                </div>
              </div>

              {data?.usage && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-bdr-subtle bg-white/[0.02] px-2 py-2">
                    <p className="text-[10px] text-txt-muted m-0">Пациенты</p>
                    <p className="text-sm font-semibold text-txt-primary m-0">
                      {data.usage.patients}
                      {data.entitlements?.maxPatients != null ? ` / ${data.entitlements.maxPatients}` : ' · ∞'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-bdr-subtle bg-white/[0.02] px-2 py-2">
                    <p className="text-[10px] text-txt-muted m-0">Сотрудники</p>
                    <p className="text-sm font-semibold text-txt-primary m-0">
                      {data.usage.users}
                      {data.entitlements?.maxUsers != null ? ` / ${data.entitlements.maxUsers}` : ' · ∞'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-bdr-subtle bg-white/[0.02] px-2 py-2">
                    <p className="text-[10px] text-txt-muted m-0">AI / мес</p>
                    <p className="text-sm font-semibold text-txt-primary m-0">
                      {data.usage.aiRequestsThisMonth || 0}
                      {data.entitlements?.aiRequestsPerMonth === 0
                        ? ' · нет'
                        : data.entitlements?.aiRequestsPerMonth != null
                          ? ` / ${data.entitlements.aiRequestsPerMonth}`
                          : ' · ∞'}
                    </p>
                  </div>
                </div>
              )}

              {(data?.expired || data?.expiringSoon) && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <p>
                    {data.expired
                      ? 'Подписка истекла — создание записей и пациентов заблокировано API. Оплатите тариф ниже.'
                      : `До окончания осталось ${data.daysLeft} дн. Продлите заранее — уведомления приходят за 14, 7 и 1 день.`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {pendingPay?.payment && (
            <PaymentQrPanel
              payment={pendingPay.payment}
              title={`Тариф ${pendingPay.plan} · ${pendingPay.months} мес.`}
              amount={pendingPay.amountTenge}
              busy={busy === 'confirm'}
              onConfirm={confirmPay}
              onCancel={() => { stopPoll(); setPendingPay(null) }}
              hint="Подписка продлевается только после подтверждения оплаты. Кнопка ниже проверяет статус у платёжного провайдера."
            />
          )}

          <div className="flex items-center gap-3">
            <p className="text-xs text-txt-muted">Период оплаты:</p>
            {[1, 3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  months === m
                    ? 'border-dv-gold text-dv-gold bg-dv-gold/10'
                    : 'border-white/[0.08] text-txt-muted hover:text-txt-primary'
                }`}
              >
                {m} мес.
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {plans.map((p) => {
              const isCurrent = currentPlan === p.id || (currentPlan === 'free' && p.id === 'starter')
              const total = (p.priceTenge || 0) * (p.priceTenge > 0 ? months : 1)
              return (
                <Card key={p.id} className={p.popular ? 'ring-1 ring-dv-gold/40' : undefined}>
                  <CardContent className="p-5 space-y-3 h-full flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {PLAN_ICON[p.id] || <CreditCard size={18} />}
                        <p className="text-sm font-semibold text-txt-primary">{p.name}</p>
                      </div>
                      {p.popular && <Badge variant="gold">Популярный</Badge>}
                    </div>
                    <p className="text-2xl font-semibold text-txt-primary">
                      {p.priceTenge === 0 ? 'Бесплатно' : fmtMoney(total)}
                    </p>
                    <p className="text-[11px] text-txt-muted">
                      {p.priceTenge === 0 ? p.period : `${fmtMoney(p.priceTenge)} × ${months} мес.`}
                    </p>
                    <p className="text-xs text-txt-muted">{p.description}</p>
                    <ul className="space-y-1.5 flex-1">
                      {(p.features || []).map((f: string) => (
                        <li key={f} className="flex items-start gap-1.5 text-xs text-txt-primary">
                          <Check size={12} className="mt-0.5 text-dv-gold shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isCurrent && !data?.expired && !data?.expiringSoon ? 'secondary' : 'primary'}
                      disabled={!!busy || (isCurrent && status === 'active' && !data?.expiringSoon && p.priceTenge === 0)}
                      onClick={() => checkout(p.id)}
                    >
                      {busy === p.id
                        ? '…'
                        : p.priceTenge === 0
                          ? (isCurrent ? 'Текущий тариф' : 'Выбрать Starter')
                          : isCurrent && status === 'active'
                            ? `Продлить на ${months} мес.`
                            : `Оплатить ${fmtMoney(total)}`}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
