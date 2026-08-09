import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// FDI tooth numbering: 18-11 (upper right → upper left), 21-28 (lower left → lower right), 48-41 (lower right → lower left), 31-38 (lower left → lower right)
const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const TOOTH_LABELS: Record<number, string> = {
  11: '1.1', 12: '1.2', 13: '1.3', 14: '1.4', 15: '1.5', 16: '1.6', 17: '1.7', 18: '1.8',
  21: '2.1', 22: '2.2', 23: '2.3', 24: '2.4', 25: '2.5', 26: '2.6', 27: '2.7', 28: '2.8',
  31: '3.1', 32: '3.2', 33: '3.3', 34: '3.4', 35: '3.5', 36: '3.6', 37: '3.7', 38: '3.8',
  41: '4.1', 42: '4.2', 43: '4.3', 44: '4.4', 45: '4.5', 46: '4.6', 47: '4.7', 48: '4.8',
};

interface Props {
  selected: number[];
  onChange: (teeth: number[]) => void;
}

function Tooth({ num, selected, onClick }: { num: number; selected: boolean; onClick: () => void }) {
  const isUpper = num >= 11 && num <= 28;
  const isMolar = [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(num);
  const isPremolar = [14, 15, 24, 25, 34, 35, 44, 45].includes(num);
  const isCanine = [13, 23, 33, 43].includes(num);

  const size = isMolar ? 'w-9 h-11' : isPremolar ? 'w-8 h-10' : isCanine ? 'w-7 h-10' : 'w-7 h-9';
  const bg = isUpper
    ? (selected ? 'bg-dv-gold text-dv-gold-on' : 'bg-surface-2 text-txt-muted hover:bg-surface-1')
    : (selected ? 'bg-dv-gold text-dv-gold-on' : 'bg-surface-1/80 text-txt-muted hover:bg-surface-1');

  return (
    <button type="button" onClick={onClick}
      className={cn('flex items-center justify-center rounded text-[10px] font-bold transition-all border', size, bg,
        selected ? 'border-dv-gold/60 shadow-sm' : 'border-bdr-subtle')}>
      {num}
    </button>
  );
}

export default function ToothSelector({ selected, onChange }: Props) {
  const { t } = useTranslation();
  const toggleTooth = (num: number) => {
    if (selected.includes(num)) {
      onChange(selected.filter(t => t !== num));
    } else {
      onChange([...selected, num]);
    }
  };

  const selectRegion = (region: 'all' | 'upper' | 'lower' | 'left' | 'right' | 'none') => {
    switch (region) {
      case 'all': onChange([...UPPER_ARCH, ...LOWER_ARCH]); break;
      case 'upper': onChange(UPPER_ARCH); break;
      case 'lower': onChange(LOWER_ARCH); break;
      case 'left': onChange([21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38]); break;
      case 'right': onChange([18, 17, 16, 15, 14, 13, 12, 11, 48, 47, 46, 45, 44, 43, 42, 41]); break;
      case 'none': onChange([]); break;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {[
          { label: t('diagnostics.select_all'), value: 'all' as const },
          { label: t('diagnostics.top'), value: 'upper' as const },
          { label: t('diagnostics.bottom'), value: 'lower' as const },
          { label: t('diagnostics.left'), value: 'left' as const },
          { label: t('diagnostics.right'), value: 'right' as const },
          { label: t('diagnostics.deselect_all'), value: 'none' as const },
        ].map(a => (
          <button key={a.value} type="button" onClick={() => selectRegion(a.value)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-1 border border-bdr-subtle text-txt-muted hover:text-txt-primary transition-colors">
            {a.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-2/30 rounded-xl p-3 border border-bdr-subtle">
        <div className="text-[10px] text-txt-ghost text-center mb-2">{t('diagnostics.upper_jaw')}</div>
        <div className="flex justify-center gap-0.5">
          {UPPER_ARCH.map(num => (
            <Tooth key={num} num={num} selected={selected.includes(num)} onClick={() => toggleTooth(num)} />
          ))}
        </div>

        <div className="border-t border-bdr-subtle/50 my-3" />

        <div className="text-[10px] text-txt-ghost text-center mb-2">{t('diagnostics.lower_jaw')}</div>
        <div className="flex justify-center gap-0.5">
          {LOWER_ARCH.map(num => (
            <Tooth key={num} num={num} selected={selected.includes(num)} onClick={() => toggleTooth(num)} />
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-txt-muted">
          {t('diagnostics.selected_teeth')}: <span className="text-txt-primary font-medium">{selected.length}</span>
          {' · '}
          {selected.sort((a, b) => a - b).join(', ')}
        </p>
      )}
    </div>
  );
}
