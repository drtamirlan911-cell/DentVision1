import React from 'react';
import { AnatomicalToothSvg } from './AnatomicalToothSvg';
import { STATUS_META, type ToothStatusKey, type ToothSurfaces } from '@/lib/odontogram';
import { cn } from '@/lib/utils';

interface Tooth3DProps {
  toothNumber: number;
  status?: ToothStatusKey;
  surfaces?: ToothSurfaces | null;
  onClick: (toothNumber: number) => void;
  selected?: number;
  toothSize: number;
}

export function Tooth3D({ toothNumber, status, surfaces, onClick, selected, toothSize }: Tooth3DProps) {
  return (
    <AnatomicalToothSvg
      toothNumber={toothNumber}
      status={status}
      surfaces={surfaces}
      selected={selected === toothNumber}
      onClick={() => onClick(toothNumber)}
      size={toothSize}
    />
  );
}

/** Shared legend mark; the same status vocabulary is used by the chart and toolbar. */
export function StatusSwatch({ status }: { status: string }) {
  const color = STATUS_META[status]?.color || 'currentColor';
  const common = { style: { '--sw': color } as React.CSSProperties };
  if (status === 'crown') {
    return <span {...common} className="w-3 h-3 rounded-[3px] border-[1.5px] border-[var(--sw)] shrink-0" />;
  }
  if (status === 'missing') {
    return <span {...common} className="w-3 h-3 rounded-full border-[1.5px] border-dashed border-[var(--sw)] shrink-0" />;
  }
  if (status === 'extracted') {
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" {...common} aria-hidden>
        <path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke="var(--sw)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (status === 'fracture') {
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" {...common} aria-hidden>
        <path d="M7.5 1.5 L4.5 5 L7 6.5 L4 10.5" stroke="var(--sw)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  if (status === 'implant') {
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" {...common} aria-hidden>
        <circle cx="6" cy="6" r="4.6" fill="none" stroke="var(--sw)" strokeWidth="1.5" />
        <circle cx="6" cy="6" r="1.7" fill="var(--sw)" />
      </svg>
    );
  }
  return <span {...common} className="w-3 h-3 rounded-full bg-[var(--sw)] shrink-0" />;
}

interface ChartToolButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function ChartToolButton({ label, active, onClick, children }: ChartToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 min-w-[62px] transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50',
        active ? 'bg-dv-gold/12 text-txt-primary ring-1 ring-dv-gold/40' : 'text-txt-secondary hover:bg-surface-2',
      )}
    >
      {children}
      <span className="text-[10px] leading-none whitespace-nowrap">{label}</span>
    </button>
  );
}
