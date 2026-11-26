import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildToothMesh, OdontogramWebGL } from './OdontogramWebGL';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebGL odontogram geometry', () => {
  it('builds finite volumetric crown and root meshes for single-, double- and triple-root teeth', () => {
    const single = buildToothMesh(1);
    const double = buildToothMesh(2);
    const triple = buildToothMesh(3);

    expect(single.vertexCount).toBeGreaterThan(0);
    expect(double.vertexCount).toBeGreaterThan(single.vertexCount);
    expect(triple.vertexCount).toBeGreaterThan(double.vertexCount);
    for (const mesh of [single, double, triple]) {
      expect(mesh.data.length).toBe(mesh.vertexCount * 6);
      expect(Array.from(mesh.data).every(Number.isFinite)).toBe(true);
    }
  });

  it('scales crown geometry without changing the root count contract', () => {
    const standard = buildToothMesh(2, 1);
    const narrow = buildToothMesh(2, 0.7);
    expect(narrow.vertexCount).toBe(standard.vertexCount);
    expect(narrow.data).not.toEqual(standard.data);
  });
});

describe('WebGL odontogram interaction and fallback', () => {
  it('keeps all permanent FDI teeth keyboard-selectable when WebGL is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onToothClick = vi.fn();
    const upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

    render(
      <OdontogramWebGL
        upperTeeth={upper}
        lowerTeeth={lower}
        patientTeeth={{}}
        onToothClick={onToothClick}
      />,
    );

    expect(await screen.findByText('WebGL недоступен в этом браузере')).toBeTruthy();
    const toothButtons = screen.getAllByRole('button', { name: /^Зуб \d+ · healthy$/ });
    expect(toothButtons).toHaveLength(32);
    fireEvent.click(screen.getByRole('button', { name: 'Зуб 16 · healthy' }));
    expect(onToothClick).toHaveBeenCalledWith(16);
  });
});
