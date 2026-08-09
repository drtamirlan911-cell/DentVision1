import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, QrCode, CreditCard, Copy, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import {
  extractPaymentQrUrl,
  formatPayAmount,
  paymentQrImageSrc,
} from '@/utils/paymentQr'

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

export function PaymentQrPanel({
  payment,
  title,
  amount,
  currency = 'KZT',
  busy = false,
  onConfirm,
  onCancel,
  confirmLabel,
  hint,
  className,
}: PaymentQrPanelProps) {
  const { t } = useTranslation()
  const resolvedHint = hint ?? t('payment.qr_show_hint')
  const resolvedConfirmLabel = confirmLabel ?? t('payment.check_payment')
  const rootRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const qrUrl = extractPaymentQrUrl(payment)
  const amountLabel = formatPayAmount(amount ?? payment?.amountTenge ?? null, currency)
    || (payment?.amount != null
      ? formatPayAmount(Number(payment.amount) / 100, currency)
      : null)
  const heading = title || payment?.meta?.title || payment?.title || t('payment.qr_payment')

  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [payment?.id, qrUrl])

  const openPay = () => {
    if (!qrUrl) return
    window.open(qrUrl, '_blank', 'noopener,noreferrer')
  }

  const copyLink = async () => {
    if (!qrUrl) return
    try {
      await navigator.clipboard.writeText(qrUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={className}
    >
      <Card className="border-dv-gold/35 bg-gradient-to-br from-dv-gold/12 via-transparent to-transparent overflow-hidden">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-dv-gold">
                <QrCode size={18} />
                <p className="text-sm md:text-base font-semibold m-0">{t('payment.invoice_created')}</p>
                <Badge variant="outline">{t('payment.awaiting_payment')}</Badge>
                {payment?.externalId?.startsWith('kaspi_') && (
                  <Badge variant="filled" className="bg-yellow-600/20 text-yellow-600 text-2xs">{t('payment.test_badge')}</Badge>
                )}
              </div>
              <p className="text-sm text-txt-primary m-0 font-medium truncate">{heading}</p>
              {amountLabel && (
                <p className="text-xl font-bold text-dv-gold m-0 tabular-nums">{amountLabel}</p>
              )}
            </div>
          </div>

          <ol className="m-0 pl-4 space-y-1 text-xs text-txt-muted list-decimal">
            <li>{t('payment.qr_step1')}</li>
            <li>{t('payment.qr_step2')}</li>
            <li>{t('payment.qr_step3')}</li>
          </ol>

          {qrUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08, duration: 0.25 }}
                className="shrink-0 rounded-xl bg-white p-3 shadow-sm"
              >
                <img
                  src={paymentQrImageSrc(qrUrl, 200)}
                  alt={t('payment.qr_code_alt')}
                  width={200}
                  height={200}
                  className="block w-[180px] h-[180px] md:w-[200px] md:h-[200px]"
                />
              </motion.div>
              <div className="flex-1 space-y-3 w-full min-w-0">
                <p className="text-xs text-txt-muted m-0">
                  {t('payment.qr_scan_hint')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" icon={<ExternalLink size={14} />} onClick={openPay}>
                    {t('payment.open_payment')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={copied ? <Check size={14} /> : <Copy size={14} />}
                    onClick={copyLink}
                  >
                    {copied ? t('payment.copied') : t('payment.copy_link')}
                  </Button>
                </div>
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[11px] text-dv-gold/90 underline break-all"
                >
                  {qrUrl}
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90">
              {t('payment.qr_unavailable')}
              {payment?.id ? (
                <span className="block mt-1 text-txt-muted">{t('payment.invoice_id')}: {String(payment.id)}</span>
              ) : null}
            </div>
          )}

          <p className="text-[11px] text-txt-muted m-0">{resolvedHint}</p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<CreditCard size={14} />} loading={busy} onClick={onConfirm}>
              {resolvedConfirmLabel}
            </Button>
            {onCancel && (
              <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
