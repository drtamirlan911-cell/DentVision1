import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getToothMorphology, isUpperArch, type RootPattern } from './toothMorphology'
import {
  STATUS_META,
  statusColor,
  normalizeSurfaceStatus,
  type ToothSurfaces,
  type SurfaceKey,
} from '@/lib/odontogram'

type StatusKey = string

/**
 * Height of the profile view box. The anatomy is drawn between y≈3 and y≈59;
 * the box is cropped to that rather than padded to a round number, so a tooth
 * fills its cell instead of floating in it.
 */
const BUCCAL_VB_H = 62

interface AnatomicalToothSvgProps {
  toothNumber: number
  status?: StatusKey
  surfaces?: ToothSurfaces | null
  selected?: boolean
  onClick?: () => void
  className?: string
  size?: number
  /**
   * FDI number above and root-count below. On by default — the clinical
   * odontogram needs both. The patient-facing presentation turns them off: a
   * grid of numbered teeth reads as a medical chart, which is exactly what that
   * screen must not look like.
   */
  showLabels?: boolean
  /**
   * `buccal` is the tooth in profile with its roots — the default, and what
   * every existing caller renders. `occlusal` looks straight down at the
   * chewing surface; a clinical chart shows both rows so a finding can be
   * placed on a cusp, not just on a tooth.
   */
  view?: 'buccal' | 'occlusal'
  /** Hover reporting for a shared chart tooltip. */
  onHover?: (toothNumber: number | null) => void
}

/**
 * Crown silhouette, drawn in "upper" orientation: neck at y≈30, biting edge at
 * the bottom. A lower tooth is the same shape flipped (see the transform in the
 * component) — mirroring costs one transform and guarantees the two arches
 * stay consistent, where two hand-drawn sets drift apart.
 *
 * The biting edge is the point of these paths. A molar ends in two cusps with
 * a fissure between them, a canine in one point, an incisor in a flat edge —
 * that silhouette is most of what makes a chart read as teeth rather than as
 * rounded rectangles.
 */
function crownPath(pattern: RootPattern): string {
  switch (pattern) {
    case 'incisor':
      // Flat incisal edge, faintly rounded at the corners.
      return 'M13 30 C13 26.2 15.4 24 20 24 C24.6 24 27 26.2 27 30 L28 50 C28 54 26 57.4 23 58.5 C21.8 58.9 20.9 59 20 59 C19.1 59 18.2 58.9 17 58.5 C14 57.4 12 54 12 50 Z'
    case 'canine':
      // One cusp, tipped slightly — the tooth that tears.
      return 'M13 29 C13 25 15.5 20.5 20 18.5 C24.5 20.5 27 25 27 29 L28 48 C28 52 25.6 55.6 22.2 58 C21.1 58.8 20.5 60 20 61.2 C19.5 60 18.9 58.8 17.8 58 C14.4 55.6 12 52 12 48 Z'
    case 'premolar1':
    case 'premolar2':
      // Two cusps, buccal taller than lingual, with a shallow fissure.
      return 'M10 31 C9.6 26 14 23 20 23 C26 23 30.4 26 30 31 L31 49 C31 53.4 28.2 56.9 24.8 58 C22.8 58.6 21.3 56.4 20 54.4 C18.7 56.4 17.2 58.6 15.2 58 C11.8 56.9 9 53.4 9 49 Z'
    case 'molarUpper':
    case 'molarLower':
    default:
      // Two broad cusps and a central fissure — the molar table in profile.
      return 'M6.5 31 C6 25.5 11.5 22.5 20 22.5 C28.5 22.5 34 25.5 33.5 31 L34.5 49 C34.5 54 32.4 57.6 29.4 59 C27.4 59.9 25.8 58.4 24.5 56.4 C23.5 54.9 22.6 54.1 20 54.1 C17.4 54.1 16.5 54.9 15.5 56.4 C14.2 58.4 12.6 59.9 10.6 59 C7.6 57.6 5.5 54 5.5 49 Z'
  }
}

/**
 * Roots, same "upper" orientation as the crown: broad at the neck (y≈31),
 * tapering to an apex near the top and splaying outward the way real roots
 * diverge. Closed tapered shapes rather than stroked lines — a stroke of
 * constant width reads as wire, and the earlier chart did look like wire.
 */
function rootPaths(pattern: RootPattern): React.ReactNode {
  switch (pattern) {
    case 'incisor':
      return <path d="M15.8 31 C15.4 23 15.6 13 17 6.5 C17.5 3.2 22.5 3.2 23 6.5 C24.4 13 24.6 23 24.2 31 Z" />
    case 'canine':
      // The longest root in the mouth — it runs nearly to the top of the box.
      return <path d="M15.4 31 C15 22 15.2 11 16.6 4.6 C17.1 1.2 22.9 1.2 23.4 4.6 C24.8 11 25 22 24.6 31 Z" />
    case 'premolar1':
      // Two roots, buccal and palatal, splitting below the neck.
      return (
        <>
          <path d="M11.4 31 C10.8 24 9.8 15 9.4 9 C9.2 5.6 14 5.4 14.4 9 C15.2 15 16.4 24 17.2 31 Z" />
          <path d="M22.8 31 C23.6 24 24.8 15 25.6 9 C26 5.4 30.8 5.6 30.6 9 C30.2 15 29.2 24 28.6 31 Z" />
        </>
      )
    case 'premolar2':
      return <path d="M15.6 31 C15.2 23 15.4 13 16.8 6.8 C17.3 3.4 22.7 3.4 23.2 6.8 C24.6 13 24.8 23 24.4 31 Z" />
    case 'molarUpper':
      // Three: the two buccal roots splay outward, the palatal runs long.
      return (
        <>
          <path d="M6.2 31 C5.6 24 4.6 15 4.2 9 C4 5.6 9 5.2 9.6 8.8 C10.6 15 12.6 24 14 31 Z" />
          <path d="M16.6 31 C16.4 24 16.6 14 17.4 7 C17.8 3.4 22.2 3.4 22.6 7 C23.4 14 23.6 24 23.4 31 Z" />
          <path d="M26 31 C27.4 24 29.4 15 30.4 8.8 C31 5.2 36 5.6 35.8 9 C35.4 15 34.4 24 33.8 31 Z" />
        </>
      )
    case 'molarLower':
    default:
      // Two broad roots, mesial and distal.
      return (
        <>
          <path d="M8.6 31 C8 24 7 14 6.6 8 C6.4 4.4 12 4.2 12.4 8 C13.2 14 14.2 24 15 31 Z" />
          <path d="M25 31 C25.8 24 26.8 14 27.6 8 C28 4.2 33.6 4.4 33.4 8 C33 14 32 24 31.4 31 Z" />
        </>
      )
  }
}

function ImplantGlyph({ upper, fill }: { upper: boolean; fill: string }) {
  if (upper) {
    return (
      <g>
        <rect x="16.5" y="3" width="7" height="23" rx="2" fill="#78909C" stroke="#455A64" strokeWidth="0.7" />
        <path d="M16.5 7 H23.5 M16.5 11 H23.5 M16.5 15 H23.5 M16.5 19 H23.5" stroke="#546E7A" strokeWidth="0.7" />
        <path d="M15 26 L25 26 L23 32 L17 32 Z" fill="#CFD8DC" stroke="#90A4AE" strokeWidth="0.6" />
        <path
          d="M11 32 C11 29.5 14.5 27.5 20 27.5 C25.5 27.5 29 29.5 29 32 L30.5 49 C30.5 53.5 26 57 20 57 C14 57 9.5 53.5 9.5 49 Z"
          fill={fill}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.8"
        />
        <ellipse cx="20" cy="40" rx="6" ry="2" fill="rgba(0,0,0,0.12)" />
      </g>
    )
  }
  return (
    <g>
      <path
        d="M11 18 C11 15.5 14.5 13.5 20 13.5 C25.5 13.5 29 15.5 29 18 L30.5 35 C30.5 39.5 26 43 20 43 C14 43 9.5 39.5 9.5 35 Z"
        fill={fill}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.8"
      />
      <ellipse cx="20" cy="26" rx="6" ry="2" fill="rgba(0,0,0,0.12)" />
      <path d="M15 42 L25 42 L23 48 L17 48 Z" fill="#CFD8DC" stroke="#90A4AE" strokeWidth="0.6" />
      <rect x="16.5" y="48" width="7" height="23" rx="2" fill="#78909C" stroke="#455A64" strokeWidth="0.7" />
      <path d="M16.5 52 H23.5 M16.5 56 H23.5 M16.5 60 H23.5 M16.5 64 H23.5" stroke="#546E7A" strokeWidth="0.7" />
    </g>
  )
}

/** Occlusal surface zones for visual MODBL feedback — scaled per crown width. */
function surfaceRegions(pattern: RootPattern): Record<SurfaceKey, { x: number; y: number; w: number; h: number }> {
  switch (pattern) {
    case 'molarUpper':
    case 'molarLower':
      return {
        M: { x: 5.5, y: 39, w: 6, h: 15 },
        O: { x: 12, y: 39, w: 16, h: 12 },
        D: { x: 28.5, y: 39, w: 6, h: 15 },
        B: { x: 12, y: 33, w: 16, h: 5.5 },
        L: { x: 12, y: 52, w: 16, h: 5.5 },
      }
    case 'premolar1':
    case 'premolar2':
      return {
        M: { x: 9, y: 40, w: 5, h: 14 },
        O: { x: 14.5, y: 40, w: 11, h: 12 },
        D: { x: 26, y: 40, w: 5, h: 14 },
        B: { x: 14.5, y: 34, w: 11, h: 5 },
        L: { x: 14.5, y: 53, w: 11, h: 5 },
      }
    case 'canine':
      return {
        M: { x: 12, y: 38, w: 5, h: 16 },
        O: { x: 17.5, y: 38, w: 7, h: 12 },
        D: { x: 24, y: 38, w: 5, h: 16 },
        B: { x: 17.5, y: 33, w: 7, h: 5 },
        L: { x: 17.5, y: 52, w: 7, h: 5 },
      }
    case 'incisor':
    default:
      return {
        M: { x: 12.5, y: 39, w: 5, h: 15 },
        O: { x: 18, y: 39, w: 5, h: 12 },
        D: { x: 23, y: 39, w: 5, h: 15 },
        B: { x: 18, y: 34, w: 5, h: 5 },
        L: { x: 18, y: 52, w: 5, h: 5 },
      }
  }
}

function SurfaceOverlays({
  surfaces,
  upper,
  pattern,
}: {
  surfaces?: ToothSurfaces | null
  upper: boolean
  pattern: RootPattern
}) {
  if (!surfaces) return null
  const entries = Object.entries(surfaces) as [SurfaceKey, string][]
  if (!entries.length) return null
  const regions = surfaceRegions(pattern)

  return (
    <g>
      {entries.map(([key, raw]) => {
        const st = normalizeSurfaceStatus(raw)
        if (!st || st === 'healthy') return null
        const color = statusColor(st)
        const r = regions[key]
        if (!r) return null
        let y = r.y
        if (!upper && (key === 'B' || key === 'L')) {
          y = key === 'B' ? regions.L.y : regions.B.y
        }
        return (
          <rect
            key={key}
            x={r.x}
            y={y}
            width={r.w}
            height={r.h}
            rx={1.2}
            fill={color}
            opacity={0.92}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.5"
          />
        )
      })}
    </g>
  )
}

/**
 * Occlusal (chewing-surface) outline — the tooth seen from above.
 *
 * A clinical chart shows each tooth twice: once in profile with its roots, and
 * once looking straight down at the surface the caries is actually on. The
 * profile view cannot show which cusp a lesion sits in; this one can.
 * Drawn in a 40×40 box so it lines up column-for-column with the profile row.
 */
function occlusalOutline(pattern: RootPattern): string {
  switch (pattern) {
    case 'incisor':
      // Incisal edge seen from above: a narrow, gently bowed blade.
      return 'M14.5 11 C14.5 8.6 16.4 7.2 20 7.2 C23.6 7.2 25.5 8.6 25.5 11 L26 29 C26 31.6 23.4 33 20 33 C16.6 33 14 31.6 14 29 Z'
    case 'canine':
      // A single cusp pulls the mesial edge to a point.
      return 'M13.5 13 C13.5 9.6 16 6.4 20 5.4 C24 6.4 26.5 9.6 26.5 13 L27 27.5 C27 31 24 33.4 20 33.4 C16 33.4 13 31 13 27.5 Z'
    case 'premolar1':
    case 'premolar2':
      // Two cusps — an oval, waisted slightly where the fissure crosses.
      return 'M9.5 14 C9.5 10.4 14 7.8 20 7.8 C26 7.8 30.5 10.4 30.5 14 C30.8 17 30.8 23 30.5 26 C30.5 29.8 26 32.4 20 32.4 C14 32.4 9.5 29.8 9.5 26 C9.2 23 9.2 17 9.5 14 Z'
    case 'molarUpper':
    case 'molarLower':
    default:
      // Four cusps: a rounded rhomboid with a soft lobe at each corner.
      return 'M6 13.5 C6 9.4 11.2 6.2 20 6.2 C28.8 6.2 34 9.4 34 13.5 C34.4 16.5 34.4 23.5 34 26.8 C34 31 28.8 34 20 34 C11.2 34 6 31 6 26.8 C5.6 23.5 5.6 16.5 6 13.5 Z'
  }
}

/** The fissure pattern inside the occlusal table — what makes it read as a tooth. */
function occlusalFissures(pattern: RootPattern): React.ReactNode {
  switch (pattern) {
    case 'incisor':
      return <path d="M20 11 L20 29" />
    case 'canine':
      return (
        <>
          <path d="M20 9 L20 30" />
          <path d="M20 20 L15 25 M20 20 L25 25" />
        </>
      )
    case 'premolar1':
    case 'premolar2':
      // One central groove running mesiodistally between the two cusps.
      return <path d="M11.5 20 C15 18.5 25 18.5 28.5 20" />
    case 'molarUpper':
    case 'molarLower':
    default:
      // Central groove plus the buccal and lingual branches — the classic cross.
      return (
        <>
          <path d="M9.5 20 C14 18.2 26 18.2 30.5 20" />
          <path d="M16.5 9.5 C17.5 14 17.5 17 16.8 19.4" />
          <path d="M23 31 C22 26.5 22 23 22.8 20.6" />
        </>
      )
  }
}

/**
 * Clinical marks drawn *over* an intact tooth.
 *
 * The tooth stays enamel-coloured and the finding sits on it, which is how a
 * paper chart reads: a filled molar is a molar with a filling in it, not a
 * black tooth. Painting the whole crown in the status colour — the earlier
 * behaviour — loses the anatomy the rest of this file exists to draw.
 */
function StatusMarks({
  status,
  pattern,
  occlusal,
  cx,
  cy,
}: {
  status?: StatusKey
  pattern: RootPattern
  occlusal: boolean
  cx: number
  cy: number
}) {
  if (!status || status === 'healthy' || status === 'missing' || status === 'extracted' || status === 'implant') {
    return null
  }
  const wide = pattern === 'molarUpper' || pattern === 'molarLower'
  const rx = occlusal ? (wide ? 9 : 6.5) : wide ? 8.5 : 6

  if (status === 'crown') {
    // An outline that hugs the crown, not a fill: the tooth underneath is intact.
    return (
      <path
        d={occlusal ? occlusalOutline(pattern) : crownPath(pattern)}
        fill={STATUS_META.crown.color}
        fillOpacity="0.1"
        stroke={STATUS_META.crown.color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    )
  }

  if (status === 'filled') {
    // A restoration follows the fissure it filled — a lobed shape, not a disc.
    const c = STATUS_META.filled.color
    return wide ? (
      <g fill={c}>
        <rect x={cx - rx * 0.72} y={cy - 2.1} width={rx * 1.44} height="4.2" rx="1.6" />
        <rect x={cx - 2.1} y={cy - rx * 0.62} width="4.2" height={rx * 1.24} rx="1.6" />
      </g>
    ) : (
      <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={rx * 0.5} fill={c} />
    )
  }

  if (status === 'caries') {
    // An outlined lesion — visible on ivory without turning the tooth red.
    return (
      <g>
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx * 0.56}
          ry={rx * 0.46}
          fill={STATUS_META.caries.color}
          fillOpacity="0.22"
          stroke={STATUS_META.caries.color}
          strokeWidth="1.5"
        />
      </g>
    )
  }

  if (status === 'fracture') {
    // A crack: one thin jagged line, drawn across the crown.
    return (
      <path
        d={
          occlusal
            ? `M${cx - rx * 0.7} ${cy - rx * 0.5} L${cx - 1} ${cy - 0.5} L${cx + 1.4} ${cy + 1.5} L${cx + rx * 0.6} ${cy + rx * 0.55}`
            : `M${cx - 3.5} ${cy - 9} L${cx - 0.5} ${cy - 3} L${cx + 2.5} ${cy + 1} L${cx - 1} ${cy + 7}`
        }
        fill="none"
        stroke={STATUS_META.fracture.color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  if (status === 'inflammation') {
    // A soft halo at the apex (profile) or over the table (occlusal).
    return (
      <circle
        cx={cx}
        cy={cy}
        r={rx * 0.72}
        fill={STATUS_META.inflammation.color}
        fillOpacity="0.2"
        stroke={STATUS_META.inflammation.color}
        strokeWidth="1.2"
        strokeDasharray="2.5 2"
      />
    )
  }

  if (status === 'veneer') {
    return (
      <path
        d={occlusal ? occlusalOutline(pattern) : crownPath(pattern)}
        fill={STATUS_META.veneer.color}
        fillOpacity="0.16"
        stroke={STATUS_META.veneer.color}
        strokeWidth="1.3"
        strokeDasharray="3 1.6"
        strokeLinejoin="round"
      />
    )
  }

  return null
}

/** The tooth seen from above — same status vocabulary, different geometry. */
function OcclusalTooth({
  toothNumber,
  status,
  surfaces,
  pattern,
  selected,
}: {
  toothNumber: number
  status?: StatusKey
  surfaces?: ToothSurfaces | null
  pattern: RootPattern
  selected?: boolean
}) {
  const outline = occlusalOutline(pattern)
  const isMissing = status === 'missing'
  const isExtracted = status === 'extracted'
  const isImplant = status === 'implant'
  const cx = 20
  const cy = 20

  if (isMissing || isExtracted) {
    return (
      <g opacity={isExtracted ? 0.75 : 0.55}>
        <path d={outline} fill="none" stroke={STATUS_META[status].color} strokeWidth="1.3" strokeDasharray="3 2.4" />
        {isExtracted && (
          <g stroke={STATUS_META.extracted.color} strokeWidth="1.6" strokeLinecap="round">
            <line x1="13" y1="13" x2="27" y2="27" />
            <line x1="27" y1="13" x2="13" y2="27" />
          </g>
        )}
      </g>
    )
  }

  return (
    <g>
      {selected && <path d={outline} fill="none" stroke="#C9A96E" strokeWidth="2.6" opacity="0.55" />}
      <path
        d={outline}
        fill={`url(#occl-${toothNumber})`}
        stroke="#B9A48A"
        strokeOpacity="0.55"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Cusp shading: a soft inner ring so the table reads as domed, not flat. */}
      <path d={outline} fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.6" transform="scale(0.9) translate(2.2 2.2)" />
      <g fill="none" stroke="#A8967F" strokeOpacity="0.75" strokeWidth="1.1" strokeLinecap="round">
        {occlusalFissures(pattern)}
      </g>
      {isImplant ? (
        <g>
          <circle cx={cx} cy={cy} r="6" fill={STATUS_META.implant.color} fillOpacity="0.16" stroke={STATUS_META.implant.color} strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="2.2" fill={STATUS_META.implant.color} />
        </g>
      ) : (
        <StatusMarks status={status} pattern={pattern} occlusal cx={cx} cy={cy} />
      )}
      <OcclusalSurfaceMarks surfaces={surfaces} pattern={pattern} />
    </g>
  )
}

/** MODBL paint mapped onto the occlusal table's five zones. */
function OcclusalSurfaceMarks({ surfaces, pattern }: { surfaces?: ToothSurfaces | null; pattern: RootPattern }) {
  if (!surfaces) return null
  const entries = Object.entries(surfaces) as [SurfaceKey, string][]
  if (!entries.length) return null
  const wide = pattern === 'molarUpper' || pattern === 'molarLower'
  const r = wide ? 11 : 8
  const zones: Record<SurfaceKey, { x: number; y: number }> = {
    O: { x: 20, y: 20 },
    M: { x: 20, y: 20 - r },
    D: { x: 20, y: 20 + r },
    B: { x: 20 - r, y: 20 },
    L: { x: 20 + r, y: 20 },
  }
  return (
    <g>
      {entries.map(([key, raw]) => {
        const st = normalizeSurfaceStatus(raw)
        if (!st || st === 'healthy') return null
        const z = zones[key]
        if (!z) return null
        return <circle key={key} cx={z.x} cy={z.y} r="2.6" fill={statusColor(st)} stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="0.7" />
      })}
    </g>
  )
}

export function AnatomicalToothSvg({
  toothNumber,
  status,
  surfaces,
  selected,
  onClick,
  className,
  size = 42,
  showLabels = true,
  view = 'buccal',
  onHover,
}: AnatomicalToothSvgProps) {
  const { t } = useTranslation()
  const morph = getToothMorphology(toothNumber)
  const upper = isUpperArch(toothNumber)
  const isMissing = status === 'missing'
  const isImplant = status === 'implant'
  const isRootOnly = status === 'root'
  const isEndoOk = status === 'endo_ok'
  const isEndoFail = status === 'endo_fail'
  const isExtracted = status === 'extracted'
  const rootFill = isRootOnly || isEndoFail ? (STATUS_META[status || 'root']?.color || '#E67E22') : '#E7DFD3'
  const height = Math.round((size * BUCCAL_VB_H) / 40)
  const crownCy = upper ? 45 : BUCCAL_VB_H - 45
  const tooltip = `${toothNumber} · ${morph.label}${status && status !== 'healthy' ? ` · ${STATUS_META[status]?.label || status}` : ''}`

  const shell = (children: React.ReactNode, boxWidth: number, boxHeight: number) => (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(toothNumber) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(toothNumber) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={selected}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg p-0.5 transition-transform duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50',
        selected ? 'scale-110 z-10' : 'hover:scale-105',
        className,
      )}
      style={{ width: boxWidth, minHeight: boxHeight }}
    >
      {children}
    </button>
  )

  if (view === 'occlusal') {
    return shell(
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id={`occl-${toothNumber}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#FDFBF7" />
            <stop offset="55%" stopColor="#F2EADC" />
            <stop offset="100%" stopColor="#E4D8C4" />
          </linearGradient>
        </defs>
        <OcclusalTooth
          toothNumber={toothNumber}
          status={status}
          surfaces={surfaces}
          pattern={morph.pattern}
          selected={selected}
        />
      </svg>,
      size + 8,
      size + 6,
    )
  }

  return shell(
    <>
      {showLabels && (
        <span
          className={cn(
            'text-[9px] font-bold tabular-nums leading-none mb-0.5',
            selected ? 'text-dv-gold' : 'text-txt-muted',
          )}
        >
          {toothNumber}
        </span>
      )}
      <svg
        width={size}
        height={height}
        viewBox={`0 0 40 ${BUCCAL_VB_H}`}
        aria-hidden
        className={cn(selected && 'drop-shadow-[0_0_8px_rgba(201,169,110,0.55)]')}
      >
        <defs>
          {/* Warm ivory rather than the old blue-grey: a tooth is bone, and the
              cool ramp read as porcelain against the reference chart. */}
          <linearGradient id={`enamel-${toothNumber}`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#FEFDFA" />
            <stop offset="48%" stopColor="#F5EEE1" />
            <stop offset="100%" stopColor="#E3D6C0" />
          </linearGradient>
          <linearGradient id={`rootGrad-${toothNumber}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={upper ? '#DFCFB4' : '#F2E9DA'} />
            <stop offset="100%" stopColor={upper ? '#F2E9DA' : '#DFCFB4'} />
          </linearGradient>
        </defs>

        {selected && (
          <rect x="1" y="1" width="38" height={BUCCAL_VB_H - 2} rx="6" fill="none" stroke="#C9A96E" strokeWidth="1.4" strokeDasharray="3 2" />
        )}

        {/* Everything anatomical is drawn upper-side-up and mirrored for the
            lower arch, so both arches are guaranteed to match. Glyphs carrying
            text stay outside the flip — they would render upside down. */}
        <g transform={upper ? undefined : `translate(0,${BUCCAL_VB_H}) scale(1,-1)`}>
          {isImplant ? (
            <ImplantGlyph upper fill={STATUS_META.implant.color} />
          ) : isMissing || isExtracted ? (
            <g opacity={isExtracted ? 0.75 : 0.5}>
              <path
                d={crownPath(morph.pattern)}
                fill="none"
                stroke={STATUS_META[status || 'missing'].color}
                strokeWidth="1.3"
                strokeDasharray="3 2.4"
                strokeLinejoin="round"
              />
              {isExtracted && (
                <g stroke={STATUS_META.extracted.color} strokeWidth="1.7" strokeLinecap="round">
                  <line x1="12.5" y1="33" x2="27.5" y2="53" />
                  <line x1="27.5" y1="33" x2="12.5" y2="53" />
                </g>
              )}
            </g>
          ) : (
            <g>
              <g
                fill={isRootOnly || isEndoFail ? rootFill : `url(#rootGrad-${toothNumber})`}
                stroke="#B39B7E"
                strokeOpacity="0.55"
                strokeWidth="0.8"
                strokeLinejoin="round"
              >
                {rootPaths(morph.pattern)}
              </g>

              {/* The crown keeps its enamel: findings are drawn on the tooth,
                  not instead of it — see StatusMarks. */}
              <path
                d={crownPath(morph.pattern)}
                fill={`url(#enamel-${toothNumber})`}
                stroke="#B39B7E"
                strokeOpacity="0.7"
                strokeWidth="0.9"
                strokeLinejoin="round"
                opacity={isRootOnly ? 0.35 : 1}
              />

              {/* Specular highlight down the buccal face. */}
              {!isRootOnly && (
                <path
                  d="M14.5 37 C15.6 43 15.8 48 15.4 52.5"
                  fill="none"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              )}

              {!isRootOnly && (
                <StatusMarks status={status} pattern={morph.pattern} occlusal={false} cx={20} cy={45} />
              )}

              <SurfaceOverlays surfaces={surfaces} upper pattern={morph.pattern} />
            </g>
          )}
        </g>

        {/* Endo marker on crown center — unflipped so the tick reads correctly. */}
        {(isEndoOk || isEndoFail) && !isMissing && !isExtracted && (
          <g>
            <circle cx="20" cy={crownCy} r="4.5" fill={isEndoOk ? '#2ECC71' : '#C0392B'} stroke="white" strokeWidth="0.8" />
            <text x="20" y={crownCy + 2.2} textAnchor="middle" fontSize="6" fontWeight="700" fill="white">
              {isEndoOk ? '✓' : '✗'}
            </text>
          </g>
        )}
      </svg>
      {showLabels && (
        <span className="text-[8px] text-txt-muted/70 leading-none mt-0.5 tabular-nums">
          {isImplant ? t('diagnostics.implant_abbr') : isEndoOk ? t('diagnostics.endo_ok') : isEndoFail ? t('diagnostics.endo_fail') : `${morph.roots}к`}
        </span>
      )}
    </>,
    size + 10,
    height + 20,
  )
}
