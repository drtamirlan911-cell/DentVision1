// ═══════════════════════════════════════════════════════════════════
// 3D ODONTOGRAM COMPONENT
// Full tooth surface mapping (M, O, D, B, L) with color coding
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { T, TOOTH_STATUS, TOOTH_SURFACES, UPPER, LOWER } from '../utils/constants';
import { Card, Badge } from './ui/BaseComponents';

/**
 * Single tooth component with surface-level detail
 */
export function Tooth3D({ toothNumber, status, surfaces, onClick, selected }) {
  const [hovered, setHovered] = useState(false);
  
  const baseColor = status ? TOOTH_STATUS[status]?.c : "rgba(255,255,255,0.07)";
  const isSelected = selected === toothNumber;
  
  // Surface colors - default to base color if not specified
  const surfaceColors = {
    M: surfaces?.M || baseColor,
    O: surfaces?.O || baseColor,
    D: surfaces?.D || baseColor,
    B: surfaces?.B || baseColor,
    L: surfaces?.L || baseColor,
  };

  return (
    <div
      onClick={() => onClick(toothNumber)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 48,
        height: 56,
        borderRadius: 8,
        background: baseColor,
        border: isSelected ? `2px solid ${T.gold}` : `1px solid rgba(255,255,255,0.08)`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transform: isSelected || hovered ? 'scale(1.08)' : 'scale(1)',
        transition: 'all 0.15s ease',
        boxShadow: isSelected ? `0 4px 12px ${baseColor}60` : 'none',
      }}
    >
      {/* Tooth number */}
      <span style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: 700,
        marginBottom: 2
      }}>
        {toothNumber}
      </span>
      
      {/* Surface indicators - mini grid showing each surface */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        width: '80%',
        height: '60%'
      }}>
        {/* Top row: M O D */}
        <div style={{
          background: surfaceColors.M,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.1)'
        }} title="Mesial" />
        <div style={{
          background: surfaceColors.O,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.1)'
        }} title="Occlusal" />
        <div style={{
          background: surfaceColors.D,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.1)'
        }} title="Distal" />
        {/* Bottom row: B L (merged) */}
        <div style={{
          gridColumn: 'span 3',
          background: surfaceColors.B,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 6,
          color: 'rgba(255,255,255,0.5)'
        }}>
          B/L
        </div>
      </div>
      
      {/* Status indicator dot */}
      {status && (
        <div style={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: TOOTH_STATUS[status]?.c || T.ruby,
          border: '1px solid rgba(255,255,255,0.3)'
        }} />
      )}
    </div>
  );
}

/**
 * Full odontogram with upper and lower arches
 */
export function Odontogram3D({ patientTeeth = {}, onToothClick, selectedTooth }) {
  const renderRow = (teeth, isUpper) => (
    <div style={{
      display: 'flex',
      gap: 4,
      justifyContent: 'center',
      marginBottom: isUpper ? 8 : 0,
      flexWrap: 'wrap',
      padding: '8px 0'
    }}>
      {teeth.map(toothNum => {
        const toothData = patientTeeth[toothNum];
        const status = typeof toothData === 'string' ? toothData : toothData?.status;
        const surfaces = typeof toothData === 'object' ? toothData?.surfaces : null;
        
        return (
          <Tooth3D
            key={toothNum}
            toothNumber={toothNum}
            status={status}
            surfaces={surfaces}
            onClick={onToothClick}
            selected={selectedTooth}
          />
        );
      })}
    </div>
  );

  return (
    <Card style={{ padding: 20 }}>
      {/* Upper arch */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          textAlign: 'center', 
          fontSize: 11, 
          color: T.slate, 
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>
          Верхняя челюсть
        </div>
        {renderRow(UPPER, true)}
      </div>
      
      {/* Divider */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${T.borderSub}, transparent)`,
        margin: '12px 0'
      }} />
      
      {/* Lower arch */}
      <div>
        <div style={{ 
          textAlign: 'center', 
          fontSize: 11, 
          color: T.slate, 
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>
          Нижняя челюсть
        </div>
        {renderRow(LOWER, false)}
      </div>
    </Card>
  );
}

/**
 * Surface editor for detailed tooth work
 */
export function SurfaceEditor({ toothNumber, surfaces, onSave, onCancel }) {
  const [editedSurfaces, setEditedSurfaces] = useState(surfaces || {});
  const [selectedSurface, setSelectedSurface] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('caries');

  const handleSurfaceClick = (surface) => {
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
    <Card style={{ padding: 16, marginTop: 12 }}>
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
        <Badge color={T.sapphire}>Редактирование поверхностей</Badge>
      </div>
      
      {/* Surface grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 8,
        marginBottom: 16
      }}>
        {TOOTH_SURFACES.map(surface => (
          <button
            key={surface}
            onClick={() => handleSurfaceClick(surface)}
            style={{
              padding: '12px 8px',
              background: selectedSurface === surface 
                ? `${T.gold}20` 
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${selectedSurface === surface ? T.gold : T.borderSub}`,
              borderRadius: 8,
              color: selectedSurface === surface ? T.gold : T.slate,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>{surface}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>
              {surface === 'M' && 'Медиальная'}
              {surface === 'O' && 'Окклюзия'}
              {surface === 'D' && 'Дистальная'}
              {surface === 'B' && 'Буккальная'}
              {surface === 'L' && 'Лингвальная'}
            </span>
            {editedSurfaces[surface] && (
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: editedSurfaces[surface],
                border: '1px solid rgba(255,255,255,0.3)'
              }} />
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
          {Object.entries(TOOTH_STATUS).map(([key, value]) => (
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

/**
 * Treatment plan auto-generator based on tooth status
 */
export function AutoTreatmentPlan({ teeth, onAddToPlan }) {
  const recommendations = [];

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
      <Card style={{ padding: 16, marginTop: 12 }}>
        <div style={{ textAlign: 'center', color: T.emerald, fontSize: 13 }}>
          ✓ Все зубы здоровы! Рекомендуется профилактический осмотр каждые 6 месяцев.
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 16, marginTop: 12 }}>
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
        <Badge color={T.amber}>{recommendations.length} процедур</Badge>
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
              color={rec.urgency === 'high' ? T.ruby : rec.urgency === 'medium' ? T.amber : T.slate}
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
    <div style={{
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      padding: '10px 0'
    }}>
      {Object.entries(TOOTH_STATUS).map(([key, value]) => (
        <div key={key} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: T.slate
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: value.c
          }} />
          {value.l}
        </div>
      ))}
    </div>
  );
}

// Default export for Odontogram3D component
export default Odontogram3D;
