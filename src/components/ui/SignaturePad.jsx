import React, { useRef, useState, useEffect, useCallback } from 'react';
import { T } from '../../utils/constants';

export default function SignaturePad({ onSave, width = 400, height = 200 }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#C9A96E';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height]);

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const startDraw = useCallback((e) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }, [getPos]);

  const draw = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  }, [drawing, getPos]);

  const stopDraw = useCallback(() => setDrawing(false), []);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, width, height);
    setHasSignature(false);
  };

  const save = () => {
    if (!hasSignature) return;
    const canvas = canvasRef.current;
    const data = canvas.toDataURL('image/png');
    onSave?.(data);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: T.slateL, marginBottom: 6 }}>Подпись</p>
      <canvas
        ref={canvasRef}
        style={{ width, height, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'crosshair', touchAction: 'none' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={clear} style={{
          padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.slateL, fontSize: 12, cursor: 'pointer',
        }}>Очистить</button>
        <button type="button" onClick={save} disabled={!hasSignature} style={{
          padding: '8px 16px', background: hasSignature ? `linear-gradient(135deg,${T.gold},${T.goldDim})` : 'rgba(255,255,255,0.05)',
          border: 'none', borderRadius: 6, color: hasSignature ? T.bg : T.slate, fontSize: 12,
          fontWeight: 600, cursor: hasSignature ? 'pointer' : 'not-allowed',
        }}>Применить подпись</button>
      </div>
    </div>
  );
}
