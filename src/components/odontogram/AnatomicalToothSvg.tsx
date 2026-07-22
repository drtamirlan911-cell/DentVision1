import React from 'react'
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

interface AnatomicalToothSvgProps {
  toothNumber: number
  status?: StatusKey
  surfaces?: ToothSurfaces | null
  selected?: boolean
  onClick?: () => void
  className?: string
  size?: number
}

function crownPath(pattern: RootPattern): string {
  switch (pattern) {
    case 'incisor':
      return 'M13 29 C13 26 15.5 24 20 24 C24.5 24 27 26 27 29 L28.5 49 C28.5 53 25 56 20 56 C15 56 11.5 53 11.5 49 Z'
    case 'canine':
      return 'M14 27 C14 24 16.5 19 20 17 C23.5 19 26 24 26 27 L28 49 C28 53 24.5 56 20 56 C15.5 56 12 53 12 49 Z'
    case 'premolar1':
    case 'premolar2':
      return 'M11 29 C11 25.5 14.5 23 20 23 C25.5 23 29 25.5 29 29 L30.5 49 C30.5 53.5 26 57 20 57 C14 57 9.5 53.5 9.5 49 Z'
    case 'molarUpper':
    case 'molarLower':
      return 'M7 29 C7 24.5 12 21.5 20 21.5 C28 21.5 33 24.5 33 29 L34.5 50 C34.5 55 28.5 58.5 20 58.5 C11.5 58.5 5.5 55 5.5 50 Z'
    default:
      return 'M13 29 C13 26 15.5 24 20 24 C24.5 24 27 26 27 29 L28.5 49 C28.5 53 25 56 20 56 C15 56 11.5 53 11.5 49 Z'
  }
}

function upperRoots(pattern: RootPattern): React.ReactNode {
  switch (pattern) {
    case 'incisor':
      return <path d="M17.5 29 L16.5 7 C16.5 4 18.2 2 20 2 C21.8 2 23.5 4 23.5 7 L22.5 29" />
    case 'canine':
      return <path d="M17.5 27 L16.2 3 C16.2 1.2 18 0.5 20 0.5 C22 0.5 23.8 1.2 23.8 3 L22.5 27" />
    case 'premolar1':
      return (
        <>
          <path d="M13.5 29 L11.5 9 C11.5 6 13.2 4 15 4 C16.8 4 18 6 18 9 L18 29" />
          <path d="M22 29 L22 9 C22 6 23.2 4 25 4 C26.8 4 28.5 6 28.5 9 L26.5 29" />
        </>
      )
    case 'premolar2':
      return <path d="M17.5 29 L16.5 7 C16.5 4 18.2 2 20 2 C21.8 2 23.5 4 23.5 7 L22.5 29" />
    case 'molarUpper':
      return (
        <>
          <path d="M10.5 29 L7.5 7 C7.5 4 9.5 2 11.5 2 C13.5 2 14.5 4 14.5 7 L14.5 29" />
          <path d="M18 29 L18 5 C18 2.5 19 1 20 1 C21 1 22 2.5 22 5 L22 29" />
          <path d="M25.5 29 L25.5 7 C25.5 4 26.5 2 28.5 2 C30.5 2 32.5 4 32.5 7 L29.5 29" />
        </>
      )
    case 'molarLower':
      return (
        <>
          <path d="M12.5 29 L10.5 7 C10.5 4 12.5 2 14.5 2 C16.5 2 17.5 4 17.5 7 L17.5 29" />
          <path d="M22.5 29 L22.5 7 C22.5 4 23.5 2 25.5 2 C27.5 2 29.5 4 29.5 7 L27.5 29" />
        </>
      )
    default:
      return <path d="M17.5 29 L16.5 7 C16.5 4 18.2 2 20 2 C21.8 2 23.5 4 23.5 7 L22.5 29" />
  }
}

function lowerRoots(pattern: RootPattern): React.ReactNode {
  switch (pattern) {
    case 'incisor':
      return <path d="M17.5 49 L16.5 67 C16.5 70 18.2 72 20 72 C21.8 72 23.5 70 23.5 67 L22.5 49" />
    case 'canine':
      return <path d="M17.5 49 L16.2 71 C16.2 72.8 18 73.5 20 73.5 C22 73.5 23.8 72.8 23.8 71 L22.5 49" />
    case 'premolar1':
      return (
        <>
          <path d="M13.5 49 L11.5 65 C11.5 68 13.2 70 15 70 C16.8 70 18 68 18 65 L18 49" />
          <path d="M22 49 L22 65 C22 68 23.2 70 25 70 C26.8 70 28.5 68 28.5 65 L26.5 49" />
        </>
      )
    case 'premolar2':
      return <path d="M17.5 49 L16.5 67 C16.5 70 18.2 72 20 72 C21.8 72 23.5 70 23.5 67 L22.5 49" />
    case 'molarUpper':
      return (
        <>
          <path d="M10.5 49 L7.5 67 C7.5 70 9.5 72 11.5 72 C13.5 72 14.5 70 14.5 67 L14.5 49" />
          <path d="M18 49 L18 69 C18 71.5 19 73 20 73 C21 73 22 71.5 22 69 L22 49" />
          <path d="M25.5 49 L25.5 67 C25.5 70 26.5 72 28.5 72 C30.5 72 32.5 70 32.5 67 L29.5 49" />
        </>
      )
    case 'molarLower':
      return (
        <>
          <path d="M12.5 49 L10.5 67 C10.5 70 12.5 72 14.5 72 C16.5 72 17.5 70 17.5 67 L17.5 49" />
          <path d="M22.5 49 L22.5 67 C22.5 70 23.5 72 25.5 72 C27.5 72 29.5 70 29.5 67 L27.5 49" />
        </>
      )
    default:
      return <path d="M17.5 49 L16.5 67 C16.5 70 18.2 72 20 72 C21.8 72 23.5 70 23.5 67 L22.5 49" />
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

/** Occlusal surface zones for visual MODBL feedback (crown bbox ~ x 8–32, y 28–52). */
const SURFACE_REGIONS: Record<SurfaceKey, { x: number; y: number; w: number; h: number }> = {
  M: { x: 8, y: 34, w: 5, h: 14 },
  O: { x: 14, y: 34, w: 12, h: 12 },
  D: { x: 27, y: 34, w: 5, h: 14 },
  B: { x: 14, y: 28, w: 12, h: 5 },
  L: { x: 14, y: 47, w: 12, h: 5 },
}

function SurfaceOverlays({
  surfaces,
  upper,
}: {
  surfaces?: ToothSurfaces | null
  upper: boolean
}) {
  if (!surfaces) return null
  const entries = Object.entries(surfaces) as [SurfaceKey, string][]
  if (!entries.length) return null

  return (
    <g>
      {entries.map(([key, raw]) => {
        const st = normalizeSurfaceStatus(raw)
        if (!st || st === 'healthy') return null
        const color = statusColor(st)
        const r = SURFACE_REGIONS[key]
        if (!r) return null
        // Flip B/L for lower arch visual orientation
        let y = r.y
        if (!upper && (key === 'B' || key === 'L')) {
          y = key === 'B' ? SURFACE_REGIONS.L.y : SURFACE_REGIONS.B.y
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

export function AnatomicalToothSvg({
  toothNumber,
  status,
  surfaces,
  selected,
  onClick,
  className,
  size = 42,
}: AnatomicalToothSvgProps) {
  const morph = getToothMorphology(toothNumber)
  const upper = isUpperArch(toothNumber)
  const isMissing = status === 'missing'
  const isImplant = status === 'implant'
  const isRootOnly = status === 'root'
  const isEndoOk = status === 'endo_ok'
  const isEndoFail = status === 'endo_fail'
  const solidFill = STATUS_META[status || '']?.color || '#E8EEF0'
  const rootFill = isRootOnly || isEndoFail ? (STATUS_META[status || 'root']?.color || '#E67E22') : '#D7DEE8'
  const crownFill = isRootOnly ? 'rgba(255,255,255,0.1)' : solidFill
  const height = Math.round(size * 1.85)
  const hasSurfaces = surfaces && Object.values(surfaces).some((v) => normalizeSurfaceStatus(v) && normalizeSurfaceStatus(v) !== 'healthy')

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${toothNumber} · ${morph.label}${status ? ` · ${STATUS_META[status]?.label || status}` : ''}`}
      aria-label={`Зуб ${toothNumber}`}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg p-0.5 transition-transform duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50',
        selected ? 'scale-110 z-10' : 'hover:scale-105',
        className,
      )}
      style={{ width: size + 10, minHeight: height + 20 }}
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
        className={cn(selected && 'drop-shadow-[0_0_8px_rgba(201,169,110,0.55)]')}
      >
        <defs>
          <linearGradient id={`enamel-${toothNumber}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="45%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
          <linearGradient id={`rootGrad-${toothNumber}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ECEFF4" />
            <stop offset="100%" stopColor="#C5CDD8" />
          </linearGradient>
        </defs>

        {selected && (
          <rect x="1" y="1" width="38" height="72" rx="6" fill="none" stroke="#C9A96E" strokeWidth="1.4" strokeDasharray="3 2" />
        )}

        {isImplant ? (
          <ImplantGlyph upper={upper} fill={STATUS_META.implant.color} />
        ) : isMissing ? (
          <g opacity="0.5">
            <path d={crownPath(morph.pattern)} fill="none" stroke="#E74C3C" strokeWidth="1.3" strokeDasharray="3 2" />
            <line x1="12" y1="28" x2="28" y2="52" stroke="#E74C3C" strokeWidth="1.5" />
            <line x1="28" y1="28" x2="12" y2="52" stroke="#E74C3C" strokeWidth="1.5" />
          </g>
        ) : (
          <g>
            <g
              fill={status && status !== 'healthy' && (isRootOnly || isEndoOk || isEndoFail) ? rootFill : `url(#rootGrad-${toothNumber})`}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="0.85"
              strokeLinejoin="round"
            >
              {upper ? upperRoots(morph.pattern) : lowerRoots(morph.pattern)}
            </g>

            <path
              d={crownPath(morph.pattern)}
              fill={status && status !== 'healthy' && !hasSurfaces ? crownFill : `url(#enamel-${toothNumber})`}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="0.9"
              strokeLinejoin="round"
              opacity={isRootOnly ? 0.35 : 1}
            />

            {/* Specular highlight */}
            {!isRootOnly && (
              <path
                d="M14 32 C16 30 18 29.5 20 29.5 C22 29.5 24 30 26 32"
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            )}

            {/* Occlusal groove hint */}
            {(morph.pattern === 'molarUpper' || morph.pattern === 'molarLower' || morph.pattern.startsWith('premolar')) && !isRootOnly && (
              <ellipse
                cx="20"
                cy={upper ? 42 : 36}
                rx={morph.pattern.startsWith('molar') ? 7.5 : 5}
                ry="2"
                fill="rgba(0,0,0,0.12)"
              />
            )}

            <SurfaceOverlays surfaces={surfaces} upper={upper} />

            {/* Endo marker on crown center */}
            {(isEndoOk || isEndoFail) && (
              <g>
                <circle cx="20" cy={upper ? 40 : 34} r="4.5" fill={isEndoOk ? '#2ECC71' : '#C0392B'} stroke="white" strokeWidth="0.8" />
                <text
                  x="20"
                  y={upper ? 42.2 : 36.2}
                  textAnchor="middle"
                  fontSize="6"
                  fontWeight="700"
                  fill="white"
                >
                  {isEndoOk ? '✓' : '✗'}
                </text>
              </g>
            )}
          </g>
        )}
      </svg>
      <span className="text-[8px] text-txt-muted/70 leading-none mt-0.5 tabular-nums">
        {isImplant ? 'импл.' : isEndoOk ? 'эндо✓' : isEndoFail ? 'эндо✗' : `${morph.roots}к`}
      </span>
    </button>
  )
}
