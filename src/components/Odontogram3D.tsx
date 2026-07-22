// ═══════════════════════════════════════════════════════════════════
// ODONTOGRAM — textbook anatomical teeth (1/2/3 roots + implants)
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { T, TOOTH_STATUS, TOOTH_SURFACES, UPPER, LOWER } from '../utils/constants';
import { Card } from './ui/ds/Card';
import { Badge } from './ui/ds/Badge';
import { AnatomicalToothSvg } from './odontogram/AnatomicalToothSvg';
import { getToothMorphology } from './odontogram/toothMorphology';
import { cn } from '@/lib/utils';

type ToothStatusKey = keyof typeof TOOTH_STATUS;

interface ToothSurfaces {
  M?: string;
  O?: string;
  D?: string;
  B?: string;
  L?: string;
}

interface ToothData {
  status?: ToothStatusKey;
  surfaces?: ToothSurfaces;
}

type PatientTeeth = Record<number, string | ToothData>;

interface Tooth3DProps {
  toothNumber: number;
  status?: ToothStatusKey;
  surfaces?: ToothSurfaces | null;
  onClick: (toothNumber: number) => void;
  selected?: number;
}

/**
 * Single tooth — anatomical SVG (crown + roots / implant).
 * Kept name Tooth3D for backward-compatible imports.
 */
export function Tooth3D({ toothNumber, status, onClick, selected }: Tooth3DProps) {
  return (
    <AnatomicalToothSvg
      toothNumber={toothNumber}
      status={status}
      selected={selected === toothNumber}
      onClick={() => onClick(toothNumber)}
      size={36}
    />
  );
}

interface Odontogram3DProps {
  patientTeeth?: PatientTeeth;
  onToothClick: (toothNumber: number) => void;
  selectedTooth?: number;
}

/**
 * Full odontogram with upper and lower arches (FDI).
 * Contained horizontal scroll on mobile — page does not slide sideways.
 */
export function Odontogram3D({ patientTeeth = {}, onToothClick, selectedTooth }: Odontogram3DProps) {
  const renderArch = (teeth: readonly number[], label: string, upper: boolean) => {
    const right = teeth.slice(0, 8); // Q1 or Q4
    const left = teeth.slice(8);     // Q2 or Q3
    return (
      <div className="space-y-2">
        <div className="text-center text-[10px] uppercase tracking-[0.12em] text-txt-muted font-semibold">
          {label}
        </div>
        <div className="overflow-x-auto overscroll-x-contain -mx-1 px-1">
          <div
            className={cn(
              'inline-flex min-w-full justify-center items-end gap-0.5 sm:gap-1 py-1',
              !upper && 'items-start',
            )}
          >
            {right.map((n) => {
              const toothData = patientTeeth[n];
              const status = typeof toothData === 'string' ? (toothData as ToothStatusKey) : toothData?.status;
              return (
                <Tooth3D
                  key={n}
                  toothNumber={n}
                  status={status}
                  onClick={onToothClick}
                  selected={selectedTooth}
                />
              );
            })}
            <div
              className="w-px self-stretch mx-1 sm:mx-1.5 bg-gradient-to-b from-transparent via-dv-gold/50 to-transparent shrink-0"
              aria-hidden
            />
            {left.map((n) => {
              const toothData = patientTeeth[n];
              const status = typeof toothData === 'string' ? (toothData as ToothStatusKey) : toothData?.status;
              return (
                <Tooth3D
                  key={n}
                  toothNumber={n}
                  status={status}
                  onClick={onToothClick}
                  selected={selectedTooth}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-txt-muted/50 px-2">
          <span>{upper ? 'Q1 (UR)' : 'Q4 (LR)'}</span>
          <span className="text-dv-gold/70">средняя линия</span>
          <span>{upper ? 'Q2 (UL)' : 'Q3 (LL)'}</span>
        </div>
      </div>
    );
  };

  const selectedMorph = selectedTooth ? getToothMorphology(selectedTooth) : null;

  return (
    <Card className="p-3 sm:p-5 overflow-hidden max-w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-txt-muted">
        <span className="rounded-md border border-bdr-subtle px-2 py-0.5">1 корень — резцы, клыки</span>
        <span className="rounded-md border border-bdr-subtle px-2 py-0.5">2 корня — нижние моляры / 1 премоляр в/ч</span>
        <span className="rounded-md border border-bdr-subtle px-2 py-0.5">3 корня — верхние моляры</span>
        <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 px-2 py-0.5">имплант</span>
      </div>

      {renderArch(UPPER, 'Верхняя челюсть', true)}

      <div className="h-px my-3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {renderArch(LOWER, 'Нижняя челюсть', false)}

      {selectedMorph && selectedTooth && (
        <p className="mt-3 text-center text-[11px] text-txt-secondary">
          Зуб <span className="text-dv-gold font-semibold">{selectedTooth}</span>
          {' · '}
          {selectedMorph.label}
          {' · '}
          {selectedMorph.roots === 1 ? 'однокорневой' : selectedMorph.roots === 2 ? 'двукорневой' : 'трёхкорневой'}
        </p>
      )}
    </Card>
  );
}


interface SurfaceEditorProps {
  toothNumber: number;
  surfaces?: ToothSurfaces;
  onSave: (toothNumber: number, surfaces: ToothSurfaces) => void;
  onCancel: () => void;
}

/**
 * Surface editor for detailed tooth work
 */
export function SurfaceEditor({ toothNumber, surfaces, onSave, onCancel }: SurfaceEditorProps) {
  const [editedSurfaces, setEditedSurfaces] = useState<ToothSurfaces>(surfaces || {});
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ToothStatusKey>('caries');

  const handleSurfaceClick = (surface: string) => {
    setSelectedSurface(surface);
  };

  const applyStatus = () => {
    if (!selectedSurface) return;
    setEditedSurfaces(prev => ({
      ...prev,
      [selectedSurface]: TOOTH_STATUS[selectedStatus]?.c || T.white
    }));
  };

  const handleSave = () => {
    onSave(toothNumber, editedSurfaces);
  };

  return (
    <Card className="p-4 mt-3">
      <div style={{ 
        fontSize: 13, 
        fontWeight: 700, 
        color: T.gold, 
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span>Зуб {toothNumber}</span>
        <Badge variant="info">Редактирование поверхностей</Badge>
      </div>
      
      {/* Surface grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {TOOTH_SURFACES.map(surface => (
          <button
            key={surface}
            onClick={() => handleSurfaceClick(surface)}
            className={cn(
              'px-2 py-3 rounded-lg cursor-pointer transition-all flex flex-col items-center gap-1 border',
              selectedSurface === surface
                ? 'bg-dv-gold/20 border-dv-gold text-dv-gold'
                : 'bg-white/[0.05] border-bdr-subtle text-txt-muted',
            )}
          >
            <span className="text-sm font-bold">{surface}</span>
            <span className="text-[9px] opacity-70">
              {surface === 'M' && 'Медиальная'}
              {surface === 'O' && 'Окклюзия'}
              {surface === 'D' && 'Дистальная'}
              {surface === 'B' && 'Буккальная'}
              {surface === 'L' && 'Лингвальная'}
            </span>
            {editedSurfaces[surface] && (
              <div
                className="w-2 h-2 rounded-full border border-white/30"
                style={{ background: editedSurfaces[surface] }}
              />
            )}
          </button>
        ))}
      </div>
      
      {/* Status selector */}
      {selectedSurface && (
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 16,
          padding: '12px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8
        }}>
          <span style={{ fontSize: 11, color: T.slate, alignSelf: 'center' }}>
            Статус для {selectedSurface}:
          </span>
          {(Object.entries(TOOTH_STATUS) as [ToothStatusKey, { l: string; c: string }][]).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setSelectedStatus(key)}
              style={{
                padding: '6px 12px',
                background: selectedStatus === key ? `${value.c}20` : 'transparent',
                border: `1px solid ${selectedStatus === key ? value.c : T.borderSub}`,
                borderRadius: 6,
                color: selectedStatus === key ? value.c : T.slate,
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <div style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: value.c
              }} />
              {value.l}
            </button>
          ))}
          <button
            onClick={applyStatus}
            style={{
              padding: '6px 16px',
              background: T.gold,
              color: T.bg,
              border: 'none',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            Применить
          </button>
        </div>
      )}
      
      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: `1px solid ${T.borderSub}`,
            color: T.slate,
            borderRadius: 7,
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 20px',
            background: `linear-gradient(135deg,${T.gold},${T.goldDim})`,
            color: T.bg,
            border: 'none',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Сохранить
        </button>
      </div>
    </Card>
  );
}

interface TreatmentRecommendation {
  tooth: string;
  procedure: string;
  urgency: 'high' | 'medium' | 'low';
  estimatedPrice: number;
}

interface AutoTreatmentPlanProps {
  teeth: PatientTeeth;
  onAddToPlan: (recommendations: TreatmentRecommendation[]) => void;
}

/**
 * Treatment plan auto-generator based on tooth status
 */
export function AutoTreatmentPlan({ teeth, onAddToPlan }: AutoTreatmentPlanProps) {
  const recommendations: TreatmentRecommendation[] = [];

  Object.entries(teeth).forEach(([toothNum, data]) => {
    const status = typeof data === 'string' ? data : data?.status;
    
    switch (status) {
      case 'caries':
        recommendations.push({
          tooth: toothNum,
          procedure: 'Лечение кариеса',
          urgency: 'medium',
          estimatedPrice: 15000
        });
        break;
      case 'missing':
        recommendations.push({
          tooth: toothNum,
          procedure: 'Имплантация или мостовидный протез',
          urgency: 'low',
          estimatedPrice: 200000
        });
        break;
      case 'root':
        recommendations.push({
          tooth: toothNum,
          procedure: 'Перелечивание каналов / удаление',
          urgency: 'high',
          estimatedPrice: 30000
        });
        break;
      default:
        break;
    }
  });

  if (recommendations.length === 0) {
    return (
      <Card className="p-4 mt-3">
        <div style={{ textAlign: 'center', color: T.emerald, fontSize: 13 }}>
          ✓ Все зубы здоровы! Рекомендуется профилактический осмотр каждые 6 месяцев.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mt-3">
      <div style={{ 
        fontSize: 13, 
        fontWeight: 700, 
        color: T.gold, 
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span>📋 Автоматический план лечения</span>
        <Badge variant="warning">{recommendations.length} процедур</Badge>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            style={{
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${T.borderSub}`,
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: T.white, fontWeight: 600 }}>
                Зуб {rec.tooth}: {rec.procedure}
              </div>
              <div style={{ fontSize: 10, color: T.slate, marginTop: 2 }}>
                ~{new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(rec.estimatedPrice)}
              </div>
            </div>
            <Badge 
              variant={rec.urgency === 'high' ? 'danger' : rec.urgency === 'medium' ? 'warning' : 'default'}
              size="sm"
            >
              {rec.urgency === 'high' ? 'Срочно' : rec.urgency === 'medium' ? 'Рекомендуется' : 'Планово'}
            </Badge>
          </div>
        ))}
      </div>
      
      <button
        onClick={() => onAddToPlan(recommendations)}
        style={{
          width: '100%',
          padding: '10px',
          marginTop: 12,
          background: `linear-gradient(135deg,${T.gold},${T.goldDim})`,
          color: T.bg,
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        Добавить в план лечения
      </button>
    </Card>
  );
}

/**
 * Legend for tooth status colors
 */
export function ToothLegend() {
  return (
    <div className="flex gap-2 sm:gap-3 flex-wrap py-2">
      {(Object.entries(TOOTH_STATUS) as [ToothStatusKey, { l: string; c: string }][]).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1.5 text-[11px] text-txt-muted">
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ background: value.c }}
          />
          {value.l}
        </div>
      ))}
    </div>
  );
}

// Default export for Odontogram3D component
export default Odontogram3D;
