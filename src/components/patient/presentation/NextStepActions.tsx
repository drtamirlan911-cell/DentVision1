import React, { useState } from 'react'
import { CalendarDays, Check, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/ds/Button'
import * as api from '@/utils/api'
import { cn } from '@/lib/utils'

/**
 * The way out of the presentation.
 *
 * The important word on this component is **request**. A patient who watched
 * six acts and tapped a button has not booked an appointment and has certainly
 * not consented to treatment: the call files a `Booking(status: 'pending')`,
 * the same thing the public widget produces, and a human at the clinic confirms
 * it. That is written in the interface text, not only in the code, because a
 * patient who believes they are booked and turns up to no slot has been misled
 * by this screen.
 *
 * No slot picker here on purpose. Choosing a time is a conversation — the
 * clinic calls back — and a grid of times would turn the closing moment of the
 * story into a form.
 */

interface NextStepActionsProps {
  /** Shown to the clinic as the reason for the request. */
  serviceName?: string | null
  className?: string
}

/** Two working days out — near enough to matter, far enough to be plausible. */
function defaultRequestDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  return date.toISOString().slice(0, 10)
}

export function NextStepActions({ serviceName, className }: NextStepActionsProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setStatus('sending')
    setError(null)
    try {
      const date = defaultRequestDate()
      const slots = await api.getPortalAvailableSlots(date)
      const time = slots?.slots?.[0]
      if (!time) {
        // No free time that day is not a failure the patient caused, and it is
        // not worth a retry loop: the clinic can be reached like a clinic.
        setStatus('failed')
        setError(t('presentation.request_no_slots'))
        return
      }
      await api.requestPortalAppointment({
        date,
        time,
        serviceName: serviceName || null,
        notes: t('presentation.request_note'),
      })
      setStatus('sent')
    } catch (e: any) {
      setStatus('failed')
      setError(e?.message || t('presentation.request_failed'))
    }
  }

  return (
    <div className={cn('space-y-2 text-center', className)}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {status === 'sent' ? (
          <span className="inline-flex items-center gap-2 text-sm text-dv-gold">
            <Check size={14} aria-hidden />
            {t('presentation.request_sent')}
          </span>
        ) : (
          <Button
            size="sm"
            icon={<CalendarDays size={14} />}
            onClick={send}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? t('presentation.request_sending') : t('presentation.request_appointment')}
          </Button>
        )}

        <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()}>
          {t('presentation.print')}
        </Button>
      </div>

      {/* Said plainly, every time, whether or not a request has been filed. */}
      <p className="mx-auto max-w-sm text-2xs text-txt-muted">
        {status === 'sent' ? t('presentation.request_sent_hint') : t('presentation.request_hint')}
      </p>

      {error && <p className="text-2xs text-error">{error}</p>}
    </div>
  )
}
