import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * The frame every patient-facing screen sits in — and only the frame.
 *
 * The portal, the booking wizard and a signed document have too little in
 * common to share content, but they should share a room: the same ground, the
 * same drifting light, the same measure. Pulling that into one component is
 * what stops the three from drifting apart as each is edited.
 *
 * The highlights are lifted from `PublicBooking.tsx` (the one screen that
 * already looked considered) with one correction. There they were written as
 * `rgba(201,169,110,0.12)` — the brand gold hard-coded in rgb form, which the
 * token guard misses because it looks for the hex. Frozen like that, the glow
 * stayed dark-theme gold on a light-theme page. Through
 * `color-mix(… var(--dv-gold) …)` it follows the theme, and the inline style
 * is exempt from the guard for the honest reason: it *is* reading the token.
 */

type SurfaceWidth = 'reading' | 'wide'

const WIDTH: Record<SurfaceWidth, string> = {
  /** Records, documents, lists — held near the comfortable line length. */
  reading: 'max-w-4xl',
  /** A conversation needs the room; cards inside it stack two-up. */
  wide: 'max-w-5xl',
}

interface PatientSurfaceProps {
  children: React.ReactNode
  /**
   * The mast: who the patient is and which clinic they are looking at. Runs
   * full-bleed above the measure so it reads as the page's masthead rather
   * than as the first card in the stack.
   */
  mast?: React.ReactNode
  footer?: React.ReactNode
  width?: SurfaceWidth
  className?: string
  contentClassName?: string
}

export function PatientSurface({
  children,
  mast,
  footer,
  width = 'reading',
  className,
  contentClassName,
}: PatientSurfaceProps) {
  const reduceMotion = useReducedMotion()

  // 25s and 20s, deliberately coprime with each other and slow enough that the
  // movement is never the thing you notice — only that the page isn't dead.
  const drift = reduceMotion
    ? {}
    : {
        animate: { x: [0, 40, -20, 60, 0], y: [0, -30, 50, -10, 0] },
        transition: { duration: 25, repeat: Infinity, ease: 'easeInOut' as const },
      }

  const driftAlt = reduceMotion
    ? {}
    : {
        animate: { x: [0, -50, 30, -20, 0], y: [0, 40, -30, 20, 0] },
        transition: { duration: 20, repeat: Infinity, ease: 'easeInOut' as const },
      }

  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-surface-0', className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute -right-48 -top-48 h-[600px] w-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--dv-gold) 12%, transparent) 0%, transparent 70%)',
          }}
          {...drift}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--dv-info) 8%, transparent) 0%, transparent 70%)',
          }}
          {...driftAlt}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {mast}

        <main
          className={cn(
            'mx-auto w-full flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8',
            WIDTH[width],
            contentClassName
          )}
        >
          {children}
        </main>

        {footer && (
          <footer className="border-t border-bdr-subtle">
            <div className={cn('mx-auto w-full px-4 py-6 sm:px-6', WIDTH[width])}>{footer}</div>
          </footer>
        )}
      </div>
    </div>
  )
}

export default PatientSurface
