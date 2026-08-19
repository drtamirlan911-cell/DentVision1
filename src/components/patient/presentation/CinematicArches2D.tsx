import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { AnatomicalToothSvg } from '@/components/odontogram/AnatomicalToothSvg'
import { UPPER, LOWER } from '@/utils/constants'
import { cn } from '@/lib/utils'
import type { BeatPriority, StageDirection } from '@/lib/presentation/beats'
import type { VisualizationContext, VisualizationSurface } from '@/lib/presentation/director'

/**
 * The patient's own arches, with a camera.
 *
 * Nothing here draws a tooth: `AnatomicalToothSvg` already renders real
 * per-tooth anatomy — crown curves and roots by morphology — and the clinical
 * odontogram depends on it, so it is used untouched.
 *
 * The "camera" is a CSS transform on a wrapper, with `transform-origin` computed
 * from the bounding box of whatever the beat asked to highlight. Vector art
 * stays sharp at any zoom, the whole thing weighs kilobytes, and when a real 3D
 * surface arrives it implements the same `VisualizationSurface` interface and
 * nothing above it changes.
 */

const PRIORITY_TONE: Record<BeatPriority, string> = {
  now: 'var(--dv-error)',
  plan: 'var(--dv-warning)',
  watch: 'var(--dv-info)',
}

const ZOOM_SCALE: Record<NonNullable<NonNullable<StageDirection['camera']>['zoom']>, number> = {
  wide: 1,
  medium: 1.35,
  close: 1.9,
}

interface CinematicArches2DProps {
  /** Called once with the surface handle the director should drive. */
  onReady?: (surface: VisualizationSurface) => void
  className?: string
}

interface Framing {
  scale: number
  originX: number
  originY: number
}

const NEUTRAL_FRAMING: Framing = { scale: 1, originX: 50, originY: 50 }

export function CinematicArches2D({ onReady, className }: CinematicArches2DProps) {
  const prefersReducedMotion = useReducedMotion()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const toothRefs = useRef(new Map<number, HTMLElement>())

  const [highlighted, setHighlighted] = useState<number[]>([])
  const [priority, setPriority] = useState<BeatPriority | null>(null)
  const [framing, setFraming] = useState<Framing>(NEUTRAL_FRAMING)
  /**
   * Sixteen teeth are wider than a phone, and the stage clips. Measure the
   * arches and shrink them to fit, then let the camera zoom on top of that —
   * one mechanism, so a close-up on a 390px screen still lands correctly.
   */
  const archRef = useRef<HTMLDivElement | null>(null)
  const [fitScale, setFitScale] = useState(1)

  useEffect(() => {
    const stage = stageRef.current
    const arch = archRef.current
    if (!stage || !arch) return

    const measure = () => {
      const available = stage.clientWidth
      const needed = arch.scrollWidth
      setFitScale(needed > 0 && available > 0 ? Math.min(1, available / needed) : 1)
    }
    measure()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(arch)
    return () => observer.disconnect()
  }, [])

  /**
   * Frame the highlighted teeth: the camera's origin is the centre of their
   * bounding box, expressed as a percentage of the stage so the transform stays
   * correct at any viewport size.
   */
  const frameTeeth = (teeth: number[], zoom: number): Framing => {
    const stage = stageRef.current
    if (!stage || teeth.length === 0 || zoom === 1) return { ...NEUTRAL_FRAMING, scale: zoom }

    const stageBox = stage.getBoundingClientRect()
    if (stageBox.width === 0 || stageBox.height === 0) return { ...NEUTRAL_FRAMING, scale: zoom }

    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity
    let found = 0

    for (const fdi of teeth) {
      const el = toothRefs.current.get(fdi)
      if (!el) continue
      const box = el.getBoundingClientRect()
      left = Math.min(left, box.left)
      right = Math.max(right, box.right)
      top = Math.min(top, box.top)
      bottom = Math.max(bottom, box.bottom)
      found += 1
    }
    if (found === 0) return { ...NEUTRAL_FRAMING, scale: zoom }

    const centreX = ((left + right) / 2 - stageBox.left) / stageBox.width
    const centreY = ((top + bottom) / 2 - stageBox.top) / stageBox.height
    return {
      scale: zoom,
      originX: Math.min(100, Math.max(0, centreX * 100)),
      originY: Math.min(100, Math.max(0, centreY * 100)),
    }
  }

  const surface = useMemo<VisualizationSurface>(
    () => ({
      capabilities: { camera3d: false, occlusalView: false, animation: true },
      apply(direction: StageDirection, ctx: VisualizationContext) {
        const teeth = direction.highlightTeeth ?? []
        setHighlighted(teeth)
        setPriority(direction.emphasis?.priority ?? null)

        const wants = direction.camera?.zoom ?? 'wide'
        // Reduced motion still frames the subject — it just cuts instead of
        // gliding, which the transition below handles.
        const zoom = direction.camera?.focus === 'none' ? 1 : ZOOM_SCALE[wants]
        setFraming(frameTeeth(teeth, ctx.reducedMotion ? Math.min(zoom, 1.35) : zoom))
      },
    }),
    [],
  )

  useEffect(() => {
    onReady?.(surface)
  }, [onReady, surface])

  const registerTooth = (fdi: number) => (el: HTMLElement | null) => {
    if (el) toothRefs.current.set(fdi, el)
    else toothRefs.current.delete(fdi)
  }

  // Big enough to read as "your mouth" rather than as a chart, small enough
  // that all sixteen still fit across a 390px phone.
  const toothSize = 34

  const renderArch = (teeth: readonly number[], upper: boolean) => {
    const right = teeth.slice(0, 8)
    const left = teeth.slice(8)
    const renderTooth = (fdi: number) => {
      const isLit = highlighted.includes(fdi)
      return (
        <span
          key={fdi}
          ref={registerTooth(fdi)}
          className={cn(
            'relative inline-flex transition-opacity duration-500',
            // Everything not being talked about recedes rather than disappears:
            // the patient keeps the context of their whole mouth.
            highlighted.length > 0 && !isLit && 'opacity-25',
          )}
        >
          {isLit && priority && (
            <motion.span
              aria-hidden
              layout
              className="pointer-events-none absolute -inset-1 rounded-full"
              style={{
                background: `radial-gradient(circle, color-mix(in srgb, ${PRIORITY_TONE[priority]} 38%, transparent) 0%, transparent 70%)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
            />
          )}
          {/* No FDI number, no root count: a grid of numbered teeth reads as
              a medical chart, and this screen must not. */}
          <AnatomicalToothSvg toothNumber={fdi} size={toothSize} showLabels={false} />
        </span>
      )
    }

    return (
      <div className={cn('flex items-end justify-center gap-px sm:gap-0.5', !upper && 'items-start')}>
        {right.map(renderTooth)}
        <span
          aria-hidden
          className="mx-1 w-px self-stretch shrink-0"
          style={{
            background:
              'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--dv-gold) 45%, transparent), transparent)',
          }}
        />
        {left.map(renderTooth)}
      </div>
    )
  }

  return (
    <div
      ref={stageRef}
      className={cn('relative flex w-full justify-center overflow-hidden', className)}
      // Decorative: the arches carry no information the script does not also
      // say out loud, so a screen reader should not have to walk 32 teeth.
      aria-hidden
    >
      <motion.div
        ref={archRef}
        className="flex w-max flex-col items-center gap-1 py-2"
        animate={{ scale: framing.scale * fitScale }}
        style={{ transformOrigin: `${framing.originX}% ${framing.originY}%` }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
        }
      >
        {renderArch(UPPER, true)}
        {renderArch(LOWER, false)}
      </motion.div>
    </div>
  )
}
