import React, { useRef, useEffect } from 'react';
import { T } from '../../utils/constants';

function generateQrMatrix(text) {
  const len = text.length;
  const version = len < 26 ? 2 : len < 50 ? 3 : 4;
  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Uint8Array(size));

  function set(x, y, v = 1) {
    if (x >= 0 && x < size && y >= 0 && y < size) matrix[y][x] = v;
  }

  for (let i = 0; i < 8; i++) {
    set(i, 0); set(size - 1 - i, 0); set(0, i); set(0, size - 1 - i);
    set(7, i); set(i, 7); set(size - 8, i); set(i, size - 8);
    set(7, size - 1 - i); set(size - 1 - i, 7);
  }

  function drawFinder(cx, cy) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const ring = i === 0 || i === 6 || j === 0 || j === 6;
        const inner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (ring || inner) set(cx - 3 + i, cy - 3 + j);
      }
    }
    for (let i = -1; i <= 7; i++) {
      set(cx - 4 + i, cy - 4); set(cx - 4 + i, cy + 4);
      set(cx - 4, cy - 4 + i); set(cx + 4, cy - 4 + i);
    }
  }

  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);

  for (let i = 8; i < size - 8; i++) {
    set(i, 6, i % 2 === 0 ? 1 : 0);
    set(6, i, i % 2 === 0 ? 1 : 0);
  }

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  let seed = Math.abs(hash) || 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x] === 0 && x > 8 && y > 8 && x < size - 8 && y < size - 8) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        if (seed % 3 === 0) matrix[y][x] = 1;
      }
    }
  }

  return { matrix, size };
}

export default function QrCode({ value, size = 160, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const { matrix, size: qrSize } = generateQrMatrix(value);
    const cellSize = size / (qrSize + 8);
    const offset = cellSize * 4;

    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, size, size);

    matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          ctx.fillStyle = T.white;
          ctx.fillRect(offset + x * cellSize, offset + y * cellSize, cellSize, cellSize);
        }
      });
    });
  }, [value, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} style={{ width: size, height: size, borderRadius: 8, border: `1px solid ${T.border}` }} />
      {label && <p style={{ fontSize: 11, color: T.slateL, textAlign: 'center', maxWidth: size }}>{label}</p>}
    </div>
  );
}
