import React from 'react'
import { isUpperArch, type RootPattern } from './toothMorphology'
import {
  STATUS_META,
  statusColor,
  normalizeSurfaceStatus,
  type ToothSurfaces,
  type SurfaceKey,
} from '@/lib/odontogram'

type StatusKey = string

/**
 * Occlusal (chewing-surface) outline — the tooth seen from above.
 *
 * A clinical chart shows each tooth twice: once in profile with its roots, and
 * once looking straight down at the surface the caries is actually on. The
 * profile view cannot show which cusp a lesion sits in; this one can.
 * Drawn in a 40×40 box so it lines up column-for-column with the profile row.
 */
function occlusalOutline(pattern: RootPattern, toothNumber: number): string {
  const lowerFirstMolar = [36, 46].includes(toothNumber)
  const lowerSecondMolar = [37, 47].includes(toothNumber)
  const upperFirstMolar = [16, 26].includes(toothNumber)
  const centralIncisor = [11, 21, 31, 41].includes(toothNumber)
  const lateralIncisor = [12, 22, 32, 42].includes(toothNumber)

  switch (pattern) {
    case 'incisor':
      // Central incisors are broader and squarer; laterals are narrower and more tapered.
      return centralIncisor
        ? 'M13.2 10.4 C13.8 8.1 16.5 7 20 7 C23.5 7 26.2 8.1 26.8 10.4 L27.1 27.3 C27.2 31.2 24.3 33 20 33 C15.7 33 12.8 31.2 12.9 27.3 Z'
        : lateralIncisor
          ? 'M14.3 10.6 C14.8 8.2 17 7 20 7 C23 7 25.2 8.2 25.7 10.6 L26.2 27.6 C26.2 31.1 23.6 32.9 20 32.9 C16.4 32.9 13.8 31.1 13.8 27.6 Z'
          : 'M14.2 10.6 C15 8 17.2 7 20 7 C22.8 7 25 8 25.8 10.6 L26.2 27 C26.1 31 23.6 33 20 33 C16.4 33 13.9 31 13.8 27 Z'
    case 'canine':
      // Prominent canine cusp with a longer distal slope and a subtle cervical flare.
      return 'M13.1 13.7 C13.7 10 16.1 6.2 20 4.8 C23.9 6.2 26.3 10 26.9 13.7 C27.4 18.1 27.8 23.2 27 27.7 C26.4 31.9 23.4 34 20 34.2 C16.6 34 13.6 31.9 13 27.7 C12.2 23.2 12.6 18.1 13.1 13.7 Z'
    case 'premolar1':
      // First premolar: asymmetric two-cusp anatomy with a characteristic mesial concavity.
      return 'M9.1 14.3 C9.7 10.7 13.1 8.1 17.3 7.3 C18.8 7 19.7 7.8 20.1 9.2 C20.5 7.8 21.6 7 23 7.4 C27 8.2 30.1 10.8 30.9 14.4 L30.8 25.9 C30.7 30.1 25.9 33 20 33.2 C14.1 33 9.3 30.1 9.2 25.9 Z'
    case 'premolar2':
      // Second premolar: rounder, lower-relief two-cusp table.
      return 'M9.8 14 C10.7 10.3 14.1 7.9 20 7.7 C25.9 7.9 29.3 10.3 30.2 14 C30.8 17.7 30.8 23.7 30.1 26.9 C29.1 30.7 25.3 32.8 20 32.9 C14.7 32.8 10.9 30.7 9.9 26.9 C9.2 23.7 9.2 17.7 9.8 14 Z'
    case 'molarUpper':
      // Upper molars are rhomboid. The first molar is larger and carries a small Carabelli-side bulge.
      if (upperFirstMolar) {
        return 'M6.8 12 C8.7 8 13.1 5.9 17.7 6.4 C18.9 6.6 19.5 7.2 20 8.2 C20.5 7.2 21.1 6.6 22.3 6.4 C26.9 5.9 31.3 8 33.2 12 C34.1 14 34.2 16.7 33.5 18.2 C34.6 20.8 34 26.7 31.2 30.1 C28.4 33.3 24.3 34.1 20 33.7 C15.7 34.1 11.6 33.3 8.8 30.1 C6 26.7 5.4 20.8 6.5 18.2 C5.8 16.7 5.9 14 6.8 12 Z'
      }
      return 'M7.3 12.2 C9.1 8.4 13.5 6.2 18 6.7 C19.1 6.8 19.6 7.4 20 8.2 C20.4 7.4 20.9 6.8 22 6.7 C26.5 6.2 30.9 8.4 32.7 12.2 L33.6 17 C33.9 20.8 33.5 26.2 30.9 29.8 C28.3 33 24.2 33.9 20 33.5 C15.8 33.9 11.7 33 9.1 29.8 C6.5 26.2 6.1 20.8 6.4 17 Z'
    case 'molarLower':
    default:
      // Lower first molars have five functional cusps; second molars settle into a four-cusp rectangle.
      if (lowerFirstMolar) {
        return 'M6.2 13.1 C7.8 9.1 12.5 7 17 7.3 C18.2 7.4 19.1 8 20 9.1 C20.9 8 21.8 7.4 23 7.3 C27.5 7 32.2 9.1 33.8 13.1 L34 25.9 C33.7 30.6 29.7 33.5 24.9 33.3 C23 33.2 21.5 32.7 20 31.7 C18.5 32.7 17 33.2 15.1 33.3 C10.3 33.5 6.3 30.6 6 25.9 Z'
      }
      if (lowerSecondMolar) {
        return 'M6.7 13.4 C8.2 9.6 12.7 7.2 17.8 7.4 C18.8 7.4 19.5 8 20 8.8 C20.5 8 21.2 7.4 22.2 7.4 C27.3 7.2 31.8 9.6 33.3 13.4 L33.5 25.8 C33.3 30.2 28.9 33 24 33 C22.1 33 20.7 32.7 20 32.1 C19.3 32.7 17.9 33 16 33 C11.1 33 6.7 30.2 6.5 25.8 Z'
      }
      return 'M7 13.3 C8.5 9.6 12.8 7.4 17.9 7.5 C18.8 7.5 19.5 8 20 8.8 C20.5 8 21.2 7.5 22.1 7.5 C27.2 7.4 31.5 9.6 33 13.3 L33.4 25.8 C33.2 30.3 28.8 33.1 24 33.1 C22.1 33.1 20.7 32.7 20 32 C19.3 32.7 17.9 33.1 16 33.1 C11.2 33.1 6.8 30.3 6.6 25.8 Z'
  }
}

/** The fissure pattern inside the occlusal table — what makes it read as a tooth. */
function thirdMolarOutline(upper: boolean): string {
  return upper
    ? 'M8.2 14 C9.5 9.8 14.1 7.1 19.2 7.5 C24.6 6.2 30 9.4 31.8 13.7 C33.2 17.4 32.1 23.7 29.5 27.8 C26.8 32 21.5 33.5 16.8 32.9 C11.7 32.3 7.7 29 7 24.4 C6.5 20.5 6.8 17 8.2 14 Z'
    : 'M7.8 14.5 C9.8 10.1 14.4 7.6 19.1 8.1 C24.3 6.8 29.8 9.2 32 13.9 C33.2 18.2 32.2 24.4 29.1 28.7 C26.2 32.4 21.3 33.4 16.4 32.7 C11.1 32 7.4 28.8 7 24.1 C6.6 20.1 6.6 17 7.8 14.5 Z'
}

function occlusalFissures(pattern: RootPattern, toothNumber: number): React.ReactNode {
  switch (pattern) {
    case 'incisor':
      return (
        <>
          <path d="M20 11 C19.7 15 19.8 20.5 20 28.7" />
          <path d="M16.1 11.5 C18 13 22 13 23.9 11.5" strokeOpacity="0.55" />
        </>
      )
    case 'canine':
      return (
        <>
          <path d="M20 8.5 C19.9 14 19.9 20.5 20 29.5" />
          <path d="M20 19 L15.1 25.5 M20 19 L24.9 25.5" />
        </>
      )
    case 'premolar1':
      return (
        <>
          <path d="M11.8 19.2 C15 18.1 17.8 18.2 20 19.4 C22.2 18.2 25 18.1 28.2 19.2" />
          <path d="M20 18.7 C20.1 21.1 20.1 23.8 20 26.2" />
          <path d="M11.8 21.2 C13.2 21.8 13.8 23.3 13.5 24.7" />
        </>
      )
    case 'premolar2':
      return (
        <>
          <path d="M12.2 19.9 C15.7 18.7 24.3 18.7 27.8 19.9" />
          <path d="M20 18.8 C20.1 21.1 20.1 23.9 20 26.2" />
        </>
      )
    case 'molarUpper':
      return (
        <>
          <path d="M9 19.4 C12.6 18.2 16.2 18.5 20 20.1 C23.8 18.5 27.4 18.2 31 19.4" />
          <path d="M15.2 10.2 C16.9 13.4 17.5 16.4 17.2 19.6" />
          <path d="M24.8 29.9 C23.1 26.8 22.5 23.4 23 20.2" />
          <path d="M20 20.1 C21.3 19 22.4 17.8 23.2 16.5" />
        </>
      )
    case 'molarLower':
    default:
      return [36, 46].includes(toothNumber)
        ? (
          <>
            <path d="M9.1 19.8 C12.5 18.5 16.6 18.6 20 20.2 C23.4 18.6 27.5 18.5 30.9 19.8" />
            <path d="M16.2 10.5 C17.7 13.6 18 16.5 17.3 19.7" />
            <path d="M23.8 29.8 C22.5 26.6 22.3 23.6 22.9 20.3" />
            <path d="M20 20.2 C20.3 22.9 20.2 26.4 20 28.8" />
          </>
        )
        : (
          <>
            <path d="M9.3 19.8 C12.8 18.5 16.8 18.6 20 20 C23.2 18.6 27.2 18.5 30.7 19.8" />
            <path d="M16 10.6 C17.4 13.7 17.9 16.4 17.4 19.6" />
            <path d="M24 29.8 C22.8 26.6 22.6 23.7 23.1 20.2" />
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
export function StatusMarks({
  status,
  pattern,
  toothNumber,
  occlusal,
  cx,
  cy,
}: {
  status?: StatusKey
  pattern: RootPattern
  toothNumber: number
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
        d={occlusal ? occlusalOutline(pattern, toothNumber) : crownPath(pattern)}
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
        d={occlusal ? occlusalOutline(pattern, toothNumber) : crownPath(pattern)}
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
function OcclusalCusps({ pattern, toothNumber }: { pattern: RootPattern; toothNumber: number }) {
  if (pattern === 'incisor') {
    return <path d="M14.5 11.7 C16.8 10.2 18.6 9.8 20 9.8 C21.4 9.8 23.2 10.2 25.5 11.7" fill="none" stroke="#e6fdff" strokeOpacity="0.58" strokeWidth="0.72" />
  }
  if (pattern === 'canine') {
    return (
      <g fill="rgba(236,254,255,0.22)" stroke="#e6fdff" strokeOpacity="0.62" strokeWidth="0.65">
        <ellipse cx="20" cy="10.1" rx="4.5" ry="3.4" />
        <path d="M20 10.1 L15.7 24.6 M20 10.1 L24.3 24.6" fill="none" />
      </g>
    )
  }
  if (pattern === 'premolar1') {
    return (
      <g fill="rgba(236,254,255,0.25)" stroke="#e6fdff" strokeOpacity="0.64" strokeWidth="0.7">
        <ellipse cx="14.5" cy="14.1" rx="4.5" ry="5.0" />
        <ellipse cx="25.6" cy="14.1" rx="4.0" ry="4.4" />
        <path d="M14.5 14.1 C17.1 18.2 18.2 20.2 20 21.7 C21.8 20.2 22.9 18.2 25.6 14.1" fill="none" />
      </g>
    )
  }
  if (pattern === 'premolar2') {
    return (
      <g fill="rgba(236,254,255,0.22)" stroke="#e6fdff" strokeOpacity="0.6" strokeWidth="0.65">
        <ellipse cx="14.8" cy="14.4" rx="4.1" ry="4.5" />
        <ellipse cx="25.2" cy="14.4" rx="4.1" ry="4.5" />
        <path d="M15 15 C17.5 18.1 18.5 20 20 20.7 C21.5 20 22.5 18.1 25 15" fill="none" />
      </g>
    )
  }
  if (pattern === 'molarUpper') {
    const first = [16, 26].includes(toothNumber)
    return (
      <g fill="rgba(236,254,255,0.2)" stroke="#e6fdff" strokeOpacity="0.64" strokeWidth="0.65">
        <ellipse cx="13.1" cy="13.1" rx="4.9" ry="4.5" />
        <ellipse cx="26.4" cy="13.1" rx="4.4" ry="4.2" />
        <ellipse cx="13.2" cy="26.2" rx="4.5" ry="4.5" />
        <ellipse cx="26.1" cy="25.7" rx="4.1" ry="4.1" />
        {first && <ellipse cx="29.8" cy="22.2" rx="1.9" ry="1.6" />}
        <path d="M13.1 13.1 C16.9 15.8 18.7 18.2 20 20 C21.5 18.2 23 15.8 26.4 13.1 M13.2 26.2 C16.8 23.8 18.5 22 20 20 C21.6 21.9 23.2 23.7 26.1 25.7" fill="none" />
      </g>
    )
  }
  const firstLowerMolar = [36, 46].includes(toothNumber)
  return (
    <g fill="rgba(236,254,255,0.2)" stroke="#e6fdff" strokeOpacity="0.64" strokeWidth="0.65">
      <ellipse cx="13" cy="13.5" rx="4.7" ry="4.4" />
      <ellipse cx="27" cy="13.5" rx="4.7" ry="4.4" />
      <ellipse cx="13.1" cy="26.1" rx="4.7" ry="4.4" />
      <ellipse cx="26.9" cy="26.1" rx="4.7" ry="4.4" />
      {firstLowerMolar && <ellipse cx="20" cy="28.8" rx="3.6" ry="2.8" />}
      <path d="M13 13.5 C16.6 16.1 18.4 18.3 20 20 C21.7 18.3 23.4 16.1 27 13.5 M13.1 26.1 C16.7 23.6 18.5 21.8 20 20 C21.5 21.8 23.3 23.6 26.9 26.1" fill="none" />
    </g>
  )
}

export function OcclusalTooth({
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
  const isThirdMolar = [18, 28, 38, 48].includes(toothNumber)
  const outline = isThirdMolar ? thirdMolarOutline(isUpperArch(toothNumber)) : occlusalOutline(pattern, toothNumber)
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
      {selected && <path d={outline} fill="none" stroke="#67e8f9" strokeWidth="2.8" opacity="0.95" filter={`url(#occl-neon-${toothNumber})`} />}
      <path
        d={outline}
        fill={`url(#occl-${toothNumber})`}
        stroke="#a5f3fc"
        strokeOpacity="0.92"
        strokeWidth="1.05"
        strokeLinejoin="round"
        filter={`url(#occl-neon-${toothNumber})`}
      />
      {/* Cusp shading: a soft inner ring so the table reads as domed, not flat. */}
      <path d={outline} fill="none" stroke="#ecfeff" strokeOpacity="0.72" strokeWidth="1.7" transform="scale(0.9) translate(2.2 2.2)" />
      <g fill="none" stroke="#075985" strokeOpacity="0.9" strokeWidth="1.05" strokeLinecap="round">
        {occlusalFissures(pattern, toothNumber)}
      </g>
      <OcclusalCusps pattern={pattern} toothNumber={toothNumber} />
      {isImplant ? (
        <g>
          <circle cx={cx} cy={cy} r="6" fill={STATUS_META.implant.color} fillOpacity="0.16" stroke={STATUS_META.implant.color} strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="2.2" fill={STATUS_META.implant.color} />
        </g>
      ) : (
        <StatusMarks status={status} pattern={pattern} toothNumber={toothNumber} occlusal cx={cx} cy={cy} />
      )}
      <OcclusalSurfaceMarks surfaces={surfaces} pattern={pattern} toothNumber={toothNumber} />
    </g>
  )
}

/** MODBL paint mapped onto the occlusal table's five zones. */
function OcclusalSurfaceMarks({ surfaces, pattern, toothNumber }: { surfaces?: ToothSurfaces | null; pattern: RootPattern; toothNumber: number }) {
  if (!surfaces) return null
  const entries = Object.entries(surfaces) as [SurfaceKey, string][]
  if (!entries.length) return null
  const wide = pattern === 'molarUpper' || pattern === 'molarLower'
  const r = wide ? 10.5 : 7.8
  const upper = isUpperArch(toothNumber)
  const zones: Record<SurfaceKey, { x: number; y: number; rx: number; ry: number }> = {
    O: { x: 20, y: 20, rx: wide ? 4.2 : 3.2, ry: wide ? 2.7 : 2.5 },
    M: { x: 20, y: 20 - r, rx: wide ? 2.5 : 2.0, ry: wide ? 3.2 : 2.8 },
    D: { x: 20, y: 20 + r, rx: wide ? 2.5 : 2.0, ry: wide ? 3.2 : 2.8 },
    B: { x: 20 - r, y: 20, rx: wide ? 3.0 : 2.4, ry: wide ? 2.2 : 2.0 },
    L: { x: 20 + r, y: 20, rx: wide ? 3.0 : 2.4, ry: wide ? 2.2 : 2.0 },
  }
  return (
    <g>
      {entries.map(([key, raw]) => {
        const st = normalizeSurfaceStatus(raw)
        if (!st || st === 'healthy') return null
        // Buccal/lingual are mirrored between the upper and lower arches.
        const mappedKey: SurfaceKey = !upper && key === 'B' ? 'L' : !upper && key === 'L' ? 'B' : key
        const z = zones[mappedKey]
        if (!z) return null
        const color = statusColor(st)
        return (
          <ellipse
            key={key}
            cx={z.x}
            cy={z.y}
            rx={z.rx}
            ry={z.ry}
            fill={color}
            fillOpacity="0.84"
            stroke="#ecfeff"
            strokeOpacity="0.92"
            strokeWidth="0.7"
            filter={`url(#occl-neon-${toothNumber})`}
          />
        )
      })}
    </g>
  )
}

