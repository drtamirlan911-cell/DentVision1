import React from 'react';
import { T } from '../../utils/constants';

const TYPE_COLORS = {
  primary: T.gold,
  success: T.emerald,
  danger: T.ruby,
  error: T.ruby,
  warning: T.amber,
  info: T.sapphire,
  purple: T.purple,
  blue: T.sapphire,
  green: T.emerald,
  red: T.ruby,
  yellow: T.amber,
  gray: T.slate,
  orange: T.orange,
  teal: T.teal,
  pink: T.pink,
  cyan: T.cyan,
};

function resolveColor(color, type) {
  if (color) return color;
  if (type) return TYPE_COLORS[type] || T.slate;
  return T.slate;
}

export function PBtn({ children, onClick, style, disabled, variant = 'primary', type = 'button', size = 'md' }) {
  const bg = variant === 'primary'
    ? `linear-gradient(135deg,${T.gold},${T.goldDim})`
    : variant === 'danger'
    ? `linear-gradient(135deg,${T.ruby},${T.ruby}99)`
    : `linear-gradient(135deg,${T.sapphire},${T.sapphire}99)`;

  const padding = size === 'sm' ? '6px 14px' : size === 'lg' ? '13px 28px' : '9px 20px';
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 15 : 13;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding,
        background: bg,
        color: T.bg,
        border: 'none',
        borderRadius: 8,
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.02em',
        boxShadow: `0 4px 14px rgba(201,169,110,.2)`,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .15s',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GBtn({ children, onClick, color, style, size = 'sm', type = 'button', disabled }) {
  const c = color || T.slateL;
  const padding = size === 'sm' ? '6px 12px' : size === 'md' ? '9px 17px' : '12px 22px';
  const fontSize = size === 'sm' ? 12 : size === 'md' ? 13 : 15;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding,
        background: `${c}15`,
        color: c,
        border: `1px solid ${c}30`,
        borderRadius: 7,
        fontSize,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        transition: 'all .12s',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children, style, onClick, hoverable = false, className }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        border: `1px solid ${T.borderSub}`,
        borderRadius: 13,
        padding: 18,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .15s',
        ...style,
      }}
      className={className}
      onMouseEnter={hoverable && onClick ? (e) => {
        e.currentTarget.style.borderColor = T.gold;
        e.currentTarget.style.background = T.cardHov;
      } : undefined}
      onMouseLeave={hoverable && onClick ? (e) => {
        e.currentTarget.style.borderColor = T.borderSub;
        e.currentTarget.style.background = T.card;
      } : undefined}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, title, value, icon, color, subtext, trend }) {
  const displayLabel = label || title;
  const displayColor = color ? (TYPE_COLORS[color] || color) : T.gold;
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.borderSub}`,
      borderRadius: 12,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        {icon && <span style={{ fontSize: 22 }}>{icon}</span>}
        {trend && (
          <span style={{
            fontSize: 11,
            color: trend.startsWith('+') ? T.emerald : T.ruby,
            background: trend.startsWith('+') ? `${T.emerald}15` : `${T.ruby}15`,
            borderRadius: 6,
            padding: '2px 7px',
            fontWeight: 600,
          }}>
            {trend}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        color: displayColor,
        fontFamily: 'Georgia,serif',
        marginBottom: 4,
        letterSpacing: '-0.01em',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: T.slate, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {displayLabel}
      </div>
      {subtext && <div style={{ fontSize: 10, color: T.slate, marginTop: 4 }}>{subtext}</div>}
    </div>
  );
}

export function PH({ title, subtitle, children }) {
  return (
    <div className="page-header" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
      flexWrap: 'wrap',
      gap: 10,
    }}>
      <div>
        <h1 style={{
          fontFamily: 'Georgia,serif',
          fontSize: 23,
          fontWeight: 700,
          color: T.white,
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>
        {subtitle && <div style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>{subtitle}</div>}
      </div>
      {children && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ST({ children }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: T.slate,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

export function Toast({ message, msg, type = 'success', onClose }) {
  const text = message || msg;
  const c = TYPE_COLORS[type] || T.emerald;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  if (!text) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      background: c,
      color: '#fff',
      padding: '13px 20px',
      borderRadius: 10,
      fontWeight: 600,
      fontSize: 13,
      boxShadow: '0 8px 28px rgba(0,0,0,.4)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      animation: 'fadeIn 0.25s ease',
      maxWidth: 360,
    }}>
      <span>{icons[type] || '●'}</span>
      <span style={{ flex: 1 }}>{text}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function ToastContainer({ toast, onClose }) {
  if (!toast) return null;
  return <Toast msg={toast.msg} type={toast.type} onClose={onClose} />;
}

export function Modal({ title, onClose, children, size = 'md' }) {
  const sizes = { sm: 380, md: 460, lg: 620, xl: 820 };
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.75)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(5px)',
        padding: '20px',
      }}
    >
      <div style={{
        background: T.navy,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: 28,
        width: sizes[size],
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingBottom: 14,
          borderBottom: `1px solid ${T.borderSub}`,
        }}>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 17, fontWeight: 700, color: T.white }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: T.slate,
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              transition: 'all .12s',
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ size = 24, color = T.gold }) {
  const s = typeof size === 'string' ? (size === 'sm' ? 18 : size === 'lg' ? 44 : 24) : size;
  return (
    <div style={{
      width: s,
      height: s,
      border: `2px solid ${color}30`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  );
}

export function Badge({ children, color, type, size = 'sm' }) {
  const c = resolveColor(color, type);
  const sizes = {
    sm: { padding: '2px 8px', fontSize: 10 },
    md: { padding: '4px 10px', fontSize: 12 },
    lg: { padding: '6px 14px', fontSize: 14 },
  };
  const s = sizes[size] || sizes.sm;
  return (
    <span style={{
      background: `${c}22`,
      color: c,
      border: `1px solid ${c}30`,
      borderRadius: 10,
      padding: s.padding,
      fontSize: s.fontSize,
      fontWeight: 600,
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function Input({ label, type = 'text', value, onChange, placeholder, disabled, error, hint, style, name, required, onKeyPress, onKeyDown }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>
          {label}{required && <span style={{ color: T.ruby, marginLeft: 3 }}>*</span>}
        </label>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onKeyPress={onKeyPress}
        onKeyDown={onKeyDown}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${error ? T.ruby : T.border}`,
          color: T.white,
          borderRadius: 8,
          padding: '10px 13px',
          fontSize: 13,
          width: '100%',
          outline: 'none',
          transition: 'border-color .2s',
          fontFamily: 'inherit',
          ...(disabled && { opacity: 0.5, cursor: 'not-allowed' }),
          ...style,
        }}
      />
      {error && <div style={{ fontSize: 11, color: T.ruby, marginTop: 4 }}>{error}</div>}
      {hint && !error && <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Select({ label, value, onChange, options = [], disabled, placeholder, style, name, required }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>
          {label}{required && <span style={{ color: T.ruby, marginLeft: 3 }}>*</span>}
        </label>
      )}
      <select
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        style={{
          background: T.navyL,
          border: `1px solid ${T.border}`,
          color: T.white,
          borderRadius: 8,
          padding: '10px 13px',
          fontSize: 13,
          width: '100%',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          ...style,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: T.navy }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Textarea({ label, value, onChange, placeholder, rows = 4, disabled, style }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${T.border}`,
          color: T.white,
          borderRadius: 8,
          padding: '10px 13px',
          fontSize: 13,
          width: '100%',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          ...(disabled && { opacity: 0.5 }),
          ...style,
        }}
      />
    </div>
  );
}

export function Divider({ style }) {
  return (
    <div style={{
      height: 1,
      background: T.borderSub,
      margin: '16px 0',
      ...style,
    }} />
  );
}

export function EmptyState({ icon = '📭', text = 'Нет данных', sub }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      color: T.slate,
    }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.slateL, marginBottom: 4 }}>{text}</div>
      {sub && <div style={{ fontSize: 12, color: T.slate }}>{sub}</div>}
    </div>
  );
}
