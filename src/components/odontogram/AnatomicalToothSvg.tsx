import React from 'react'
import { cn } from '@/lib/utils'
import { getToothMorphology, isUpperArch, type RootPattern } from './toothMorphology'

type StatusKey =
  | 'healthy'
  | 'caries'
  | 'filled'
  | 'crown'
  | 'missing'
  | 'root'
  | 'implant'
  | 'veneer'
  | string

const STATUS_FILL: Record<string, string> = {
  healthy: '#27AE60',
  caries: '#F39C12',
  filled: '#2980B9',
  crown: '#8E44AD',
  missing: 'transparent',
  root: '#E67E22',
  implant: '#00BCD4',
  veneer: '#E91E8C',
}

interface AnatomicalToothSvgProps {
  toothNumber: number
  status?: StatusKey
  selected?: boolean
  onClick?: () => void
  className?: string
  /** Width of the SVG in px (height scales) */
  size?: number
}

/** Crown outline paths by pattern — viewBox 0 0 40 72, crown in y≈28–52, roots in y≈0–30 or 52–72 */
function crownPath(pattern: RootPattern): string {
  switch (pattern) {
    case 'incisor':
      return 'M14 30 C14 28 16 26 20 26 C24 26 26 28 26 30 L27 48 C27 51 24 53 20 53 C16 53 13 51 13 48 Z'
    case 'canine':
      return 'M15 28 C15 26 17 22 20 20 C23 22 25 26 25 28 L27 48 C27 51 24 53 20 53 C16 53 13 51 13 48 Z'
    case 'premolar1':
    case 'premolar2':
      return 'M12 30 C12 27 15 25 20 25 C25 25 28 27 28 30 L29 48 C29 51 25 54 20 54 C15 54 11 51 11 48 Z'
    case 'molarUpper':
    case 'molarLower':
      return 'M8 30 C8 26 12 24 20 24 C28 24 32 26 32 30 L33 49 C33 53 28 56 20 56 C12 56 7 53 7 49 Z'
    default:
      return 'M14 30 C14 28 16 26 20 26 C24 26 26 28 26 30 L27 48 C27 51 24 53 20 53 C16 53 13 51 13 48 Z'
  }
}

/** Roots pointing UP (for upper arch — roots toward top of SVG) */
function upperRoots(pattern: RootPattern): React.ReactNode {
  switch (pattern) {
    case 'incisor':
      return <path d="M18 30 L17 8 C17 5 19 3 20 3 C21 3 23 5 23 8 L22 30" />
    case 'canine':
      return <path d="M18 28 L17 4 C17 2 19 1 20 1 C21 1 23 2 23 4 L22 28" />
    case 'premolar1':
      return (
        <>
          <path d="M14 30 L12 10 C12 7 14 5 15.5 5 C17 5 18 7 18 10 L18 30" />
          <path d="M22 30 L22 10 C22 7 23 5 24.5 5 C26 5 28 7 28 10 L26 30" />
        </>
      )
    case 'premolar2':
      return <path d="M18 30 L17 8 C17 5 19 3 20 3 C21 3 23 5 23 8 L22 30" />
    case 'molarUpper':
      return (
        <>
          <path d="M11 30 L8 8 C8 5 10 3 12 3 C14 3 15 5 15 8 L15 30" />
          <path d="M18 30 L18 6 C18 3 19 2 20 2 C21 2 22 3 22 6 L22 30" />
          <path d="M25 30 L25 8 C25 5 26 3 28 3 C30 3 32 5 32 8 L29 30" />
        </>
      )
    case 'molarLower':
      return (
        <>
          <path d="M13 30 L11 8 C11 5 13 3 15 3 C17 3 18 5 18 8 L18 30" />
          <path d="M22 30 L22 8 C22 5 23 3 25 3 C27 3 29 5 29 8 L27 30" />
        </>
      )
    default:
      return <path d="M18 30 L17 8 C17 5 19 3 20 3 C21 3 23 5 23 8 L22 30" />
  }
}

/** Roots pointing DOWN (lower arch) */
function lowerRoots(pattern: RootPattern): React.ReactNode {
  switch (pattern) {
    case 'incisor':
      return <path d="M18 48 L17 66 C17 69 19 71 20 71 C21 71 23 69 23 66 L22 48" />
    case 'canine':
      return <path d="M18 48 L17 70 C17 72 19 73 20 73 C21 73 23 72 23 70 L22 48" />
    case 'premolar1':
      return (
        <>
          <path d="M14 48 L12 64 C12 67 14 69 15.5 69 C17 69 18 67 18 64 L18 48" />
          <path d="M22 48 L22 64 C22 67 23 69 24.5 69 C26 69 28 67 28 64 L26 48" />
        </>
      )
    case 'premolar2':
      return <path d="M18 48 L17 66 C17 69 19 71 20 71 C21 71 23 69 23 66 L22 48" />
    case 'molarUpper':
      return (
        <>
          <path d="M11 48 L8 66 C8 69 10 71 12 71 C14 71 15 69 15 66 L15 48" />
          <path d="M18 48 L18 68 C18 71 19 72 20 72 C21 72 22 71 22 68 L22 48" />
          <path d="M25 48 L25 66 C25 69 26 71 28 71 C30 71 32 69 32 66 L29 48" />
        </>
      )
    case 'molarLower':
      return (
        <>
          <path d="M13 48 L11 66 C11 69 13 71 15 71 C17 71 18 69 18 66 L18 48" />
          <path d="M22 48 L22 66 C22 69 23 71 25 71 C27 71 29 69 29 66 L27 48" />
        </>
      )
    default:
      return <path d="M18 48 L17 66 C17 69 19 71 20 71 C21 71 23 69 23 66 L22 48" />
  }
}

/** Titanium implant fixture + abutment + crown silhouette */
function ImplantGlyph({ upper }: { upper: boolean }) {
  if (upper) {
    return (
      <g>
        {/* Screw in bone (up) */}
        <rect x="17" y="4" width="6" height="22" rx="1.5" fill="#90A4AE" stroke="#546E7A" strokeWidth="0.8" />
        <path d="M17 8 H23 M17 12 H23 M17 16 H23 M17 20 H23" stroke="#546E7A" strokeWidth="0.6" opacity="0.7" />
        {/* Abutment */}
        <path d="M16 26 L24 26 L22 32 L18 32 Z" fill="#CFD8DC" stroke="#78909C" strokeWidth="0.7" />
        {/* Crown */}
        <path
          d="M12 32 C12 30 15 28 20 28 C25 28 28 30 28 32 L29 48 C29 52 25 55 20 55 C15 55 11 52 11 48 Z"
          fill="currentColor"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.8"
        />
      </g>
    )
  }
  return (
    <g>
      <path
        d="M12 20 C12 17 15 15 20 15 C25 15 28 17 28 20 L29 36 C29 40 25 43 20 43 C15 43 11 40 11 36 Z"
        fill="currentColor"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.8"
      />
      <path d="M16 42 L24 42 L22 48 L18 48 Z" fill="#CFD8DC" stroke="#78909C" strokeWidth="0.7" />
      <rect x="17" y="48" width="6" height="22" rx="1.5" fill="#90A4AE" stroke="#546E7A" strokeWidth="0.8" />
      <path d="M17 52 H23 M17 56 H23 M17 60 H23 M17 64 H23" stroke="#546E7A" strokeWidth="0.6" opacity="0.7" />
    </g>
  )
}

export function AnatomicalToothSvg({
  toothNumber,
  status,
  selected,
  onClick,
  className,
  size = 44,
}: AnatomicalToothSvgProps) {
  const morph = getToothMorphology(toothNumber)
  const upper = isUpperArch(toothNumber)
  const isMissing = status === 'missing'
  const isImplant = status === 'implant'
  const isRootOnly = status === 'root'
  const fill = STATUS_FILL[status || ''] || 'rgba(226,232,240,0.55)'
  const rootFill = isRootOnly ? fill : 'rgba(241,245,249,0.35)'
  const crownFill = isRootOnly ? 'rgba(255,255,255,0.08)' : fill

  const height = Math.round(size * 1.85)

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${toothNumber} · ${morph.label}${morph.roots > 1 ? ` · ${morph.roots} корня` : ' · 1 корень'}${status ? ` · ${status}` : ''}`}
      aria-label={`Зуб ${toothNumber}`}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg p-0.5 transition-transform duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50',
        selected ? 'scale-110 z-10' : 'hover:scale-105',
        className,
      )}
      style={{ width: size + 8, minHeight: height + 18 }}
    >
      <span
        className={cn(
          'text-[9px] font-bold tabular-nums leading-none mb-0.5',
          selected ? 'text-dv-gold' : 'text-txt-muted',
        )}
      >
        {toothNumber}
      </span>
      <svg
        width={size}
        height={height}
        viewBox="0 0 40 74"
        className={cn(
          'overflow-visible transition-shadow',
          selected && 'drop-shadow-[0_0_8px_rgba(201,169,110,0.55)]',
        )}
        style={{ color: fill }}
      >
        {/* Selection ring */}
        {selected && (
          <rect
            x="1"
            y="1"
            width="38"
            height="72"
            rx="6"
            fill="none"
            stroke="#C9A96E"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            opacity="0.9"
          />
        )}

        {isImplant ? (
          <ImplantGlyph upper={upper} />
        ) : isMissing ? (
          <g opacity="0.45">
            <path
              d={crownPath(morph.pattern)}
              fill="none"
              stroke="rgba(239,68,68,0.7)"
              strokeWidth="1.2"
              strokeDasharray="3 2"
            />
            <line x1="12" y1="28" x2="28" y2="52" stroke="#E74C3C" strokeWidth="1.4" />
            <line x1="28" y1="28" x2="12" y2="52" stroke="#E74C3C" strokeWidth="1.4" />
          </g>
        ) : (
          <g>
            {/* Roots */}
            <g
              fill={rootFill}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="0.9"
              strokeLinejoin="round"
            >
              {upper ? upperRoots(morph.pattern) : lowerRoots(morph.pattern)}
            </g>
            {/* Crown */}
            <path
              d={crownPath(morph.pattern)}
              fill={crownFill}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="0.9"
              strokeLinejoin="round"
              opacity={isRootOnly ? 0.35 : 1}
            />
            {/* Occlusal hint for molars/premolars */}
            {(morph.pattern === 'molarUpper' || morph.pattern === 'molarLower' || morph.pattern.startsWith('premolar')) && !isRootOnly && (
              <ellipse
                cx="20"
                cy={upper ? 42 : 36}
                rx={morph.pattern.startsWith('molar') ? 8 : 5}
                ry="2.2"
                fill="rgba(0,0,0,0.18)"
              />
            )}
            {/* Root count ticks */}
            <g fill="rgba(255,255,255,0.35)">
              {Array.from({ length: morph.roots }).map((_, i) => (
                <circle
                  key={i}
                  cx={20 - (morph.roots - 1) * 3 + i * 6}
                  cy={upper ? 70 : 4}
                  r="1.2"
                />
              ))}
            </g>
          </g>
        )}
      </svg>
      <span className="text-[8px] text-txt-muted/60 leading-none mt-0.5 tabular-nums">
        {isImplant ? 'импл.' : `${morph.roots}к`}
      </span>
    </button>
  )
}
