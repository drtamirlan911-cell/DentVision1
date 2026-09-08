import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, QrCode, CreditCard, Copy, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { extractPaymentQrUrl, formatPayAmount, paymentQrImageSrc } from '@/utils/paymentQr'

type PaymentQrPanelProps = {
  payment: any
  title?: string
  amount?: number | string | null
  currency?: string
  busy?: boolean
  onConfirm: () => void
  onCancel?: () => void
  confirmLabel?: string
  hint?: string
  className?: string
}

export function PaymentQrPanel({ payment, title, amount, currency = 'KZT', busy = false, onConfirm, onCancel, confirmLabel, hint, className }: PaymentQrPanelProps) {
  const { t } = useTranslation()
  const resolvedHint = hint ?? t('payment.qr_show_hint')
  const resolvedConfirmLabel = confirmLabel ?? t('payment.check_payment')
  const rootRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const qrUrl = extractPaymentQrUrl(payment)
  const amountLabel = formatPayAmount(amount ?? payment?.amountTenge ?? null, currency) || (payment?.amount != null ? formatPayAmount(Number(payment.amount) / 100, currency) : null)
  const heading = title || payment?.meta?.title || payment?.title || t('payment.qr_payment')

  useEffect(() => { rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [payment?.id, qrUrl])

  const openPay = () => { if (qrUrl) window.open(qrUrl, '_blank', 'noopener,noreferrer') }
  const copyLink = async () => {
    if (!qrUrl) return
    try { await navigator.clipboard.writeText(qrUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  return (
    <motion.div ref={rootRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className={className}>
      <Card className="overflow-hidden border-bdr-subtle bg-surface-raised">
        <CardContent className="space-y-5 p-4 sm:p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold">
                  <QrCode size={17} />
                </span>
                <p className="m-0 text-sm font-semibold text-txt-primary md:text-base">{t('payment.invoice_created')}</p>
                <Badge variant="outline">{t('payment.awaiting_payment')}</Badge>
                {payment?.externalId?.startsWith('kaspi_') && <Badge variant="filled" className="bg-yellow-600/20 text-yellow-600 text-2xs">{t('payment.test_badge')}</Badge>}
              </div>
              <p className="m-0 truncate text-sm font-medium text-txt-secondary">{heading}</p>
              {amountLabel && <p className="m-0 text-2xl font-semibold tracking-tight text-txt-primary tabular-nums">{amountLabel}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-bdr-subtle bg-surface-2 p-3 sm:p-4">
            <ol className="m-0 grid gap-2 text-xs leading-5 text-txt-muted sm:grid-cols-3 sm:gap-4">
              <li>{t('payment.qr_step1')}</li>
              <li>{t('payment.qr_step2')}</li>
              <li>{t('payment.qr_step3')}</li>
            </ol>
          </div>

          {qrUrl ? (
            <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center rounded-xl border border-bdr-subtle bg-surface-2 p-3 sm:p-4">
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.08, duration: 0.25 }} className="mx-auto shrink-0 rounded-xl border border-black/5 bg-white p-3 shadow-sm sm:mx-0">
                <img src={paymentQrImageSrc(qrUrl, 200)} alt={t('payment.qr_code_alt')} width={200} height={200} className="block h-[180px] w-[180px] md:h-[200px] md:w-[200px]" />
              </motion.div>
              <div className="min-w-0 space-y-3">
                <p className="m-0 text-sm leading-5 text-txt-secondary">{t('payment.qr_scan_hint')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" icon={<ExternalLink size={14} />} onClick={openPay}>{t('payment.open_payment')}</Button>
                  <Button size="sm" variant="secondary" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyLink}>{copied ? t('payment.copied') : t('payment.copy_link')}</Button>
                </div>
                <a href={qrUrl} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-txt-muted underline decoration-dv-gold/50 underline-offset-2 hover:text-dv-gold" title={qrUrl}>{qrUrl}</a>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs leading-5 text-amber-200/90">
              {t('payment.qr_unavailable')}
              {payment?.id ? <span className="mt-1 block text-txt-muted">{t('payment.invoice_id')}: {String(payment.id)}</span> : null}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-bdr-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 max-w-2xl text-[11px] leading-4 text-txt-muted">{resolvedHint}</p>
            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
              <Button size="sm" icon={<CreditCard size={14} />} loading={busy} onClick={onConfirm}>{resolvedConfirmLabel}</Button>
              {onCancel && <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>{t('common.cancel')}</Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
