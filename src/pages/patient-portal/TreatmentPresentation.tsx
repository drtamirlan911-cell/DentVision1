import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PatientSurface } from '@/components/patient/PatientSurface'
import { CinematicArches2D } from '@/components/patient/presentation/CinematicArches2D'
import { Button } from '@/components/ui/ds/Button'
import * as api from '@/utils/api'
import { cn } from '@/lib/utils'
import type { PresentationScript } from '@/lib/presentation/beats'
import {
  PresentationDirector,
  type DirectorState,
  type VisualizationSurface,
} from '@/lib/presentation/director'
import { SilentPersona } from '@/lib/presentation/silentPersona'

/**
 * The patient's treatment plan, told rather than tabulated.
 *
 * Everything on this screen comes from a release a named doctor approved and
 * published — the route cannot reach an editable plan at all. The wording is
 * generated deterministically from the frozen snapshot, so nothing here can
 * state a price or a tooth the doctor did not.
 *
 * Deliberately *not* a medical interface: no tables, no field labels, no status
 * chips. One thing at a time, said out loud, shown on the patient's own teeth.
 */

function formatTenge(amount: number): string {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  // String-based on purpose: `new Date('2026-01-01')` is UTC midnight and
  // renders as the previous day west of Greenwich.
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null
}

export default function TreatmentPresentation() {
  const { releaseId } = useParams<{ releaseId: string }>()
  const { t, i18n } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['presentation', releaseId, i18n.language],
    queryFn: () => api.getPresentationScript(String(releaseId), i18n.language),
    enabled: Boolean(releaseId),
  })

  const script: PresentationScript | null = data?.script ?? null
  const release = data?.release ?? null

  const directorRef = useRef<PresentationDirector | null>(null)
  const surfaceRef = useRef<VisualizationSurface | null>(null)
  const [state, setState] = useState<DirectorState | null>(null)

  const handleSurfaceReady = useCallback((surface: VisualizationSurface) => {
    surfaceRef.current = surface
  }, [])

  useEffect(() => {
    if (!script || !surfaceRef.current) return

    const director = new PresentationDirector(
      script,
      new SilentPersona(),
      surfaceRef.current,
      { reducedMotion: Boolean(prefersReducedMotion) },
      { onState: setState },
    )
    directorRef.current = director
    void director.play()

    return () => {
      director.stop()
      directorRef.current = null
    }
    // `script` identity changes only when the release or locale does, which is
    // exactly when the presentation should start over.
  }, [script, prefersReducedMotion])

  const acts = script?.acts ?? []
  const beat = state?.beat ?? null
  const playing = state?.status === 'playing'
  const finished = state?.status === 'finished'

  const expiry = useMemo(() => formatDate(release?.expiresAt), [release?.expiresAt])

  if (isLoading) {
    return (
      <PatientSurface width="wide">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-bdr-subtle"
            style={{ borderTopColor: 'var(--dv-gold)' }}
            aria-label={t('common.loading')}
          />
        </div>
      </PatientSurface>
    )
  }

  if (isError || !script) {
    return (
      <PatientSurface width="wide">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <h1 className="font-serif text-2xl text-txt-primary">{t('presentation.unavailable_title')}</h1>
          <p className="max-w-sm text-sm text-txt-secondary">{t('presentation.unavailable_body')}</p>
        </div>
      </PatientSurface>
    )
  }

  return (
    <PatientSurface width="wide">
      <div className="flex min-h-[85vh] flex-col justify-center gap-8 py-6">
        {/* Act rail — where the patient is in their own story. */}
        <nav className="flex items-center justify-center gap-2" aria-label={t('presentation.acts')}>
          {acts.map((act, index) => {
            const active = index === (state?.actIndex ?? 0)
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => directorRef.current?.seekToAct(index)}
                className={cn(
                  'group flex flex-col items-center gap-1.5 px-2 py-1 text-2xs uppercase tracking-[0.18em] transition-colors',
                  active ? 'text-dv-gold' : 'text-txt-muted hover:text-txt-secondary',
                )}
              >
                <span>{act.title}</span>
                <span
                  className="h-px w-10 transition-opacity"
                  style={{
                    background: active
                      ? 'var(--dv-gold)'
                      : 'color-mix(in srgb, var(--dv-gold) 20%, transparent)',
                  }}
                />
              </button>
            )
          })}
        </nav>

        <CinematicArches2D onReady={handleSurfaceReady} />

        {/* The line being said. One thing at a time. */}
        <div className="min-h-[8rem] px-2 text-center">
          <AnimatePresence mode="wait">
            {beat && (
              <motion.div
                key={beat.id}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="mx-auto max-w-2xl space-y-3"
              >
                <p className="font-serif text-lg leading-relaxed text-txt-primary sm:text-xl">{beat.say}</p>
                {beat.caption && (
                  <p
                    className={cn(
                      'text-2xs uppercase tracking-[0.18em]',
                      beat.caption.kind === 'price' ? 'text-dv-gold' : 'text-txt-muted',
                    )}
                  >
                    {beat.caption.text}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          {/* Progress across the whole story, not per act. */}
          <div className="mx-auto h-px w-full max-w-md bg-bdr-subtle">
            <motion.div
              className="h-px"
              style={{ background: 'var(--dv-gold)' }}
              animate={{
                width: `${((state?.progress.current ?? 0) / Math.max(1, state?.progress.total ?? 1)) * 100}%`,
              }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {finished ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<RotateCcw size={14} />}
                onClick={() => directorRef.current?.seekToAct(0)}
              >
                {t('presentation.replay')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                icon={playing ? <Pause size={14} /> : <Play size={14} />}
                onClick={() =>
                  playing ? directorRef.current?.pause() : directorRef.current?.resume()
                }
              >
                {playing ? t('presentation.pause') : t('presentation.resume')}
              </Button>
            )}
          </div>

          <div className="space-y-1 text-center">
            {release?.totalAmount != null && (
              <p className="font-mono text-sm tabular-nums text-txt-secondary">
                {formatTenge(release.totalAmount)}
              </p>
            )}
            {expiry && (
              // A quoted price is an offer; the patient is entitled to know how
              // long it stands.
              <p className="text-2xs text-txt-muted">{t('presentation.valid_until', { date: expiry })}</p>
            )}
            <p className="text-2xs text-txt-muted">{t('presentation.not_a_consent')}</p>
          </div>
        </div>
      </div>
    </PatientSurface>
  )
}
