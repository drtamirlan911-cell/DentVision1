import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Banknote, CreditCard, QrCode, Smartphone, ArrowLeftRight, CheckCircle2, Wallet,
} from 'lucide-react'
import { Modal } from '@/components/ui/ds/Modal'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Badge } from '@/components/ui/ds/Badge'
import { PaymentQrPanel } from '@/components/payments/PaymentQrPanel'
import { cn } from '@/lib/utils'
import { PAY_METHODS } from '@/utils/constants'
import { isOnlineQrMethod } from '@/utils/payMethod'
import { extractPaymentQrUrl } from '@/utils/paymentQr'
import * as api from '@/utils/api'
import { useTranslation } from 'react-i18next'

function money(n: number): string {
  return `${Number(n || 0).toLocaleString('ru-RU')} ₸`
}

export type PayMethod = (typeof PAY_METHODS)[number] | string
export type PayKind = 'full' | 'prepayment' | 'credit'

export type AcceptPaymentPayload = {
  amount: number
  method: PayMethod
  paymentType: PayKind
  closeVisit: boolean
  notes?: string
  paymentId?: string
}

type AcceptPaymentModalProps = {
  open: boolean
  onClose: () => void
  patientName: string
  serviceLabel?: string
  diagnosis?: string
  toothNumber?: string | number
  suggestedAmount?: number
  defaultMethod?: PayMethod
  /** When true, offer «закрыть приём» together with payment */
  allowCloseVisit?: boolean
  defaultCloseVisit?: boolean
  saving?: boolean
  /** Clinic / appointment refs for Kaspi payment meta */
  clinicId?: string | null
  appointmentId?: string | null
  patientId?: string | null
  onConfirm: (payload: AcceptPaymentPayload) => void | Promise<void>
}



export function AcceptPaymentModal({
  open,
  onClose,
  patientName,
  serviceLabel,
  diagnosis,
  toothNumber,
  suggestedAmount = 0,
  defaultMethod,
  allowCloseVisit = false,
  defaultCloseVisit = false,
  saving = false,
  clinicId,
  appointmentId,
  patientId,
  onConfirm,
}: AcceptPaymentModalProps) {
  const { t } = useTranslation()

  const METHOD_META: Array<{
    id: string
    match: (m: string) => boolean
    label: string
    hint: string
    icon: ReactNode
    accent: string
  }> = [
    {
      id: 'qr',
      match: (m) => isOnlineQrMethod(m),
      label: t('payment.qr_payment'),
      hint: t('payment.show_qr'),
      icon: <QrCode size={18} />,
      accent: 'border-rose-400/50 bg-rose-400/10 text-rose-200',
    },
    {
      id: 'installment',
      match: (m) => m.toLowerCase().includes('рассроч'),
      label: t('payment.installment'),
      hint: t('payment.in_installment'),
      icon: <Smartphone size={18} />,
      accent: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
    },
    {
      id: 'card',
      match: (m) => m.toLowerCase().includes('карт') || m.toLowerCase().includes('терминал'),
      label: t('payment.card'),
      hint: t('payment.terminal'),
      icon: <CreditCard size={18} />,
      accent: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    },
    {
      id: 'cash',
      match: (m) => m.toLowerCase().includes('налич'),
      label: t('payment.cash'),
      hint: t('payment.cash_register'),
      icon: <Banknote size={18} />,
      accent: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    },
    {
      id: 'transfer',
      match: (m) => m.toLowerCase().includes('перевод'),
      label: t('payment.transfer'),
      hint: t('payment.transfer_bank'),
      icon: <ArrowLeftRight size={18} />,
      accent: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    },
  ]

  const PAY_KINDS: Array<{ value: PayKind; label: string }> = [
    { value: 'full', label: t('payment.full_payment') },
    { value: 'prepayment', label: t('payment.partial_payment') },
    { value: 'credit', label: t('payment.on_credit') },
  ]

  function resolveMethodOptions(): Array<{ value: string; meta: (typeof METHOD_META)[number] }> {
    return PAY_METHODS.map((method) => {
      const meta = METHOD_META.find((m) => m.match(method)) || {
        id: method,
        match: () => true,
        label: method,
        hint: t('payment.payment_title'),
        icon: <Wallet size={18} />,
        accent: 'border-dv-gold/40 bg-dv-gold/10 text-dv-gold',
      }
      return { value: method, meta }
    })
  }

  const methods = useMemo(() => resolveMethodOptions(), [])
  const [amount, setAmount] = useState(String(suggestedAmount || ''))
  const [method, setMethod] = useState<string>(defaultMethod || methods[0]?.value || t('payment.qr_payment'))
  const [payKind, setPayKind] = useState<PayKind>('full')
  const [closeVisit, setCloseVisit] = useState(defaultCloseVisit)
  const [notes, setNotes] = useState('')
  const [pendingPay, setPendingPay] = useState<any>(null)
  const [creatingQr, setCreatingQr] = useState(false)
  const [confirmingQr, setConfirmingQr] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount(String(suggestedAmount || ''))
    setMethod(defaultMethod || methods[0]?.value || t('payment.qr_payment'))
    setPayKind('full')
    setCloseVisit(defaultCloseVisit)
    setNotes('')
    setPendingPay(null)
    setCreatingQr(false)
    setConfirmingQr(false)
    setQrError(null)
  }, [open, suggestedAmount, defaultMethod, defaultCloseVisit, methods])

  const amountNum = Number(amount) || 0
  const canSubmit = amountNum > 0 && !!method && (payKind === 'credit' || amountNum > 0)
  const needsOnlineQr = isOnlineQrMethod(method) && payKind !== 'credit'

  const finishOffline = async () => {
    if (!canSubmit || saving) return
    await onConfirm({
      amount: amountNum,
      method,
      paymentType: payKind,
      closeVisit: allowCloseVisit && closeVisit,
      notes: notes.trim() || undefined,
    })
  }

  const startQrPayment = async () => {
    if (!canSubmit || creatingQr || saving) return
    setCreatingQr(true)
    setQrError(null)
    try {
      const payment = await api.createPayment({
        amount: amountNum,
        domain: 'crm',
        refType: appointmentId ? 'appointment' : 'crm_invoice',
        refId: appointmentId || patientId || null,
        meta: {
          clinicId: clinicId || null,
          patientId: patientId || null,
          patientName,
          service: serviceLabel || null,
          appointmentId: appointmentId || null,
          title: serviceLabel || t('payment.payment_generic', { name: patientName }),
        },
      })
      const qr = extractPaymentQrUrl(payment)
      setPendingPay({ ...payment, qr: qr || payment?.qr, title: serviceLabel || `Оплата · ${patientName}` })
    } catch (e: any) {
      setQrError(e?.message || t('payment.qr_create_failed'))
    } finally {
      setCreatingQr(false)
    }
  }

  const confirmQrPayment = async () => {
    if (!pendingPay?.id) return
    setConfirmingQr(true)
    setQrError(null)
    try {
      const res = await api.confirmPayment(pendingPay.id)
      if (res?.status === 'paid' || res?.settled || res?.alreadyPaid) {
        await onConfirm({
          amount: amountNum,
          method,
          paymentType: payKind,
          closeVisit: allowCloseVisit && closeVisit,
          notes: notes.trim() || undefined,
          paymentId: pendingPay.id,
        })
        setPendingPay(null)
      } else {
        setQrError(t('payment.payment_not_confirmed'))
      }
    } catch (e: any) {
      setQrError(e?.message || t('payment.payment_not_confirmed_short'))
    } finally {
      setConfirmingQr(false)
    }
  }

  const submit = async () => {
    if (needsOnlineQr) {
      await startQrPayment()
      return
    }
    await finishOffline()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pendingPay ? t('payment.payment_qr_title') : t('payment.accept')}
      size="lg"
      className="max-md:!w-[calc(100vw-1rem)] max-md:!max-h-[calc(100vh-2rem)] max-md:!m-2"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-bdr-subtle bg-gradient-to-br from-dv-gold/10 via-white/[0.03] to-transparent p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-txt-muted font-semibold">{t('payment.patient_label')}</p>
              <p className="text-base font-semibold text-txt-primary truncate">{patientName || '—'}</p>
              {serviceLabel && (
                <p className="text-xs text-txt-secondary mt-1 truncate">{serviceLabel}</p>
              )}
            </div>
            <Badge variant="gold" size="xs">{t('payment.cash_label')}</Badge>
          </div>
          {(diagnosis || toothNumber) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-txt-muted">
              {diagnosis && <span className="rounded-md bg-white/[0.04] px-2 py-1">{diagnosis}</span>}
              {toothNumber && <span className="rounded-md bg-emerald-400/10 text-emerald-300 px-2 py-1">{t('payment.tooth_badge', { n: toothNumber })}</span>}
            </div>
          )}
        </div>

        {pendingPay ? (
          <div className="space-y-3">
            <PaymentQrPanel
              payment={pendingPay}
              title={pendingPay.title || serviceLabel || t('payment.payment_generic', { name: patientName })}
              amount={amountNum}
              busy={confirmingQr || saving}
              onConfirm={confirmQrPayment}
              onCancel={() => setPendingPay(null)}
              hint={t('payment.qr_show_hint')}
            />
            {qrError && <p className="text-xs text-error m-0">{qrError}</p>}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-bdr-subtle bg-surface-raised p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-txt-muted font-semibold mb-2">{t('payment.amount_to_pay')}</p>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="!text-center !text-3xl !font-bold !h-14 !text-emerald-300 !bg-transparent !border-dv-gold/30"
                placeholder="0"
              />
              <p className="text-xs text-txt-muted mt-2">
                {amountNum > 0 ? money(amountNum) : t('payment.enter_amount')}
                {suggestedAmount > 0 && amountNum !== suggestedAmount && (
                  <button
                    type="button"
                    className="ml-2 text-dv-gold hover:underline"
                    onClick={() => setAmount(String(suggestedAmount))}
                  >
                    {t('payment.return_money', { money: money(suggestedAmount) })}
                  </button>
                )}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-txt-muted font-semibold mb-2">{t('payment.payment_method')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {methods.map(({ value, meta }) => {
                  const selected = method === value
                  return (
                    <motion.button
                      key={value}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setMethod(value)}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-all',
                        selected
                          ? meta.accent + ' ring-1 ring-inset ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                          : 'border-bdr-subtle bg-white/[0.03] text-txt-secondary hover:border-bdr-strong hover:bg-white/[0.05]',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {meta.icon}
                        {selected && <CheckCircle2 size={14} className="ml-auto opacity-80" />}
                      </div>
                      <p className="text-xs font-semibold leading-tight">{meta.label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{meta.hint}</p>
                    </motion.button>
                  )
                })}
              </div>
              {needsOnlineQr && (
                <p className="text-[11px] text-txt-muted mt-2 m-0">
                  {t('payment.qr_hint')}
                </p>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-txt-muted font-semibold mb-2">{t('payment.payment_type')}</p>
              <div className="flex rounded-xl border border-bdr-subtle overflow-hidden">
                {PAY_KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setPayKind(k.value)}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-semibold transition-colors',
                      payKind === k.value ? 'bg-dv-gold/15 text-dv-gold' : 'text-txt-muted hover:text-txt-secondary',
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label={t('payment.comment')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('payment.comment_optional')}
            />

            {allowCloseVisit && (
              <label className="flex items-center gap-3 rounded-xl border border-bdr-subtle bg-white/[0.03] px-3 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={closeVisit}
                  onChange={(e) => setCloseVisit(e.target.checked)}
                  className="h-4 w-4 accent-[#c4a574]"
                />
                <div>
                  <p className="text-sm font-semibold text-txt-primary">{t('payment.close_after_payment')}</p>
                  <p className="text-[11px] text-txt-muted">{t('payment.close_after_status')}</p>
                </div>
              </label>
            )}

            {qrError && <p className="text-xs text-error m-0">{qrError}</p>}

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                disabled={!canSubmit || saving || creatingQr}
                loading={saving || creatingQr}
                icon={needsOnlineQr ? <QrCode size={16} /> : <Wallet size={16} />}
                onClick={() => void submit()}
              >
                {creatingQr
                  ? t('payment.creating_qr')
                  : payKind === 'credit'
                    ? t('payment.set_credit')
                    : needsOnlineQr
                      ? `${t('payment.create_qr')}${amountNum > 0 ? ` · ${money(amountNum)}` : ''}`
                      : `${t('payment.accept_payment_btn')}${amountNum > 0 ? ` ${money(amountNum)}` : ''}`}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={saving || creatingQr}>{t('common.cancel')}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
