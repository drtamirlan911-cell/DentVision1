import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PatientSurface } from '@/components/patient/PatientSurface'
import { CinematicArches2D } from '@/components/patient/presentation/CinematicArches2D'
import { CostBreakdown } from '@/components/patient/presentation/CostBreakdown'
import { NextStepActions } from '@/components/patient/presentation/NextStepActions'
import { OptionsScene } from '@/components/patient/presentation/OptionsScene'
import { readPresentedOptions } from '@/lib/presentation/planOptions'
import { Button } from '@/components/ui/ds/Button'
import * as api from '@/utils/api'
import { cn } from '@/lib/utils'
import type { PresentationScript } from '@/lib/presentation/beats'
import {
  PresentationDirector,
  type DirectorState,
  type VisualizationSurface,
} from '@/lib/presentation/director'
import { AudioPersona } from '@/lib/presentation/audioPersona'

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
  const personaRef = useRef<AudioPersona | null>(null)
  const fetchedActs = useRef(new Set<string>())
  const surfaceRef = useRef<VisualizationSurface | null>(null)
  const [state, setState] = useState<DirectorState | null>(null)

  const handleSurfaceReady = useCallback((surface: VisualizationSurface) => {
    surfaceRef.current = surface
  }, [])

  /** Fetch one act's narration once, and hand the URLs to the persona. */
  const fetchAct = useCallback(
    async (actId: string | undefined, persona: AudioPersona | null) => {
      if (!releaseId || !actId || !persona || fetchedActs.current.has(actId)) return
      fetchedActs.current.add(actId)
      try {
        const data = await api.getPresentationVoice(String(releaseId), actId, i18n.language)
        persona.setUrls(data?.lines ?? [])
      } catch {
        // Silent is a supported outcome; nothing to tell the patient.
      }
    },
    [releaseId, i18n.language],
  )

  useEffect(() => {
    if (!script || !surfaceRef.current) return

    const persona = new AudioPersona()
    personaRef.current = persona
    fetchedActs.current.clear()

    const director = new PresentationDirector(
      script,
      persona,
      surfaceRef.current,
      { reducedMotion: Boolean(prefersReducedMotion) },
      { onState: setState },
    )
    directorRef.current = director

    // Load the first act's narration *before* starting. Fetching on entering an
    // act would leave the opening line silent every single time — and that is
    // the one line the whole screen exists to deliver.
    let cancelled = false
    void fetchAct(script.acts[0]?.id, persona).finally(() => {
      if (!cancelled) void director.play()
    })

    return () => {
      cancelled = true
      director.stop()
      directorRef.current = null
      personaRef.current = null
    }
    // `script`, and `fetchAct` with it, change identity only when the release or
    // the locale does — which is exactly when the presentation should start over.
  }, [script, prefersReducedMotion, fetchAct])

  const acts = script?.acts ?? []
  const beat = state?.beat ?? null
  const snapshot = data?.snapshot ?? null

  /**
   * The levels were computed and frozen at approval; this only reads them. An
   * empty list means nothing differs from the doctor's plan, and the screen
   * shows one price rather than three identical cards.
   */
  const options = useMemo(() => readPresentedOptions(snapshot), [snapshot])
  const showingOptions = beat?.stage.scene === 'options' && options.length > 0
  // The closing act is where the way out belongs — and once the story is over
  // it stays on screen rather than vanishing with the last line.
  const atNextStep = beat?.actId === 'next_step' || state?.status === 'finished'

  /**
   * Prefetch the *next* act while the current one plays, so the seam between
   * acts is not silent either. Per act rather than all six up front: most
   * patients open the first, and synthesising the rest bills for audio nobody
   * hears. Failures are swallowed on purpose — the persona already falls back
   * to reading time, so a silent presentation is the worst case, never a
   * broken one.
   */
  useEffect(() => {
    const nextActId = script?.acts[(state?.actIndex ?? 0) + 1]?.id
    if (!nextActId) return
    void fetchAct(nextActId, personaRef.current)
  }, [script, state?.actIndex, fetchAct])
  const playing = state?.status === 'playing'
  const finished = state?.status === 'finished'

  // The funnel's two touchpoints: opened it, watched it through. Both are
  // fire-and-forget and first-touch only — the backend itself is idempotent
  // (`recordPresentationMilestone`), but tracking here as well avoids firing
  // the request on every re-render.
  const trackedViewed = useRef(false)
  const trackedFinished = useRef(false)
  useEffect(() => {
    if (!releaseId || !script || trackedViewed.current) return
    trackedViewed.current = true
    void api.trackPresentationMilestone(releaseId, 'viewed').catch(() => {})
  }, [releaseId, script])
  useEffect(() => {
    if (!releaseId || !finished || trackedFinished.current) return
    trackedFinished.current = true
    void api.trackPresentationMilestone(releaseId, 'finished').catch(() => {})
  }, [releaseId, finished])

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
        {/*
          Six act titles are wider than a phone. Left as one un-wrapping row they
          overflowed in both directions: the first act was cut off the left edge
          and the last off the right, so a patient on a phone could neither see
          which act was playing nor reach any other — the rail was unusable at
          exactly the size most patients open the link on.

          Below `sm` the titles give way to their marks, which still show
          position and still take a tap; the name stays on `aria-label`, so
          nothing is lost to assistive technology. Above `sm` the titles return
          and are allowed to wrap, because some locales are much longer.
        */}
        <nav
          className="flex flex-wrap items-end justify-center gap-x-2 gap-y-2"
          aria-label={t('presentation.acts')}
        >
          {acts.map((act, index) => {
            const active = index === (state?.actIndex ?? 0)
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => directorRef.current?.seekToAct(index)}
                aria-label={act.title}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group flex min-h-[2.25rem] flex-col items-center justify-end gap-1.5 px-2 py-1 text-2xs uppercase tracking-[0.18em] transition-colors',
                  active ? 'text-dv-gold' : 'text-txt-muted hover:text-txt-secondary',
                )}
              >
                <span className="hidden sm:inline">{act.title}</span>
                <span
                  className="h-px w-8 transition-opacity sm:w-10"
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

        {/*
          The arches stay mounted through the options act rather than being
          swapped out: unmounting them would drop the surface handle the
          director is holding, and the next act would play to nothing.
        */}
        <div className="relative">
          <div className={cn('transition-opacity duration-500', showingOptions && 'pointer-events-none opacity-0')}>
            <CinematicArches2D onReady={handleSurfaceReady} />
          </div>
          <AnimatePresence>
            {showingOptions && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <OptionsScene options={options} activeKey={beat?.stage.optionKey ?? null} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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

          {/* Always available, never narrated: a patient who accepts the number
              should not have to walk a table to get past it. */}
          {snapshot && release?.totalAmount != null && (
            <CostBreakdown snapshot={snapshot} total={release.totalAmount} />
          )}

          {/*
            The doctor's own plan title, not an act title: this lands in the
            clinic's booking list, where "Ваш план лечения" — a line written to
            address the patient — tells whoever picks it up nothing.
          */}
          {atNextStep && (
            <NextStepActions
              serviceName={(snapshot as { title?: string } | null)?.title ?? null}
              releaseId={releaseId}
            />
          )}
        </div>
      </div>
    </PatientSurface>
  )
}
