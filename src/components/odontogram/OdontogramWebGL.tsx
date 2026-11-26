import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { STATUS_META, normalizeTooth, type PatientTeeth } from '@/lib/odontogram';
import { getToothMorphology } from './toothMorphology';

type ToothPoint = { tooth: number; x: number; y: number; upper: boolean };
type ToothMesh = { data: Float32Array; vertexCount: number };

export interface OdontogramWebGLProps {
  upperTeeth: readonly number[];
  lowerTeeth: readonly number[];
  patientTeeth: PatientTeeth;
  selectedTooth?: number;
  onToothClick: (toothNumber: number) => void;
}

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uViewProjection;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  gl_Position = uViewProjection * world;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uColor;
uniform float uSelected;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDirection = normalize(vec3(-0.38, 0.62, 0.72));
  float diffuse = max(dot(normal, lightDirection), 0.0);
  vec3 viewDirection = normalize(vec3(0.0, 0.0, 18.0) - vWorldPosition);
  vec3 reflected = reflect(-lightDirection, normal);
  float specular = pow(max(dot(viewDirection, reflected), 0.0), 30.0) * 0.24;
  vec3 enamel = mix(uColor, vec3(0.34, 0.91, 1.0), uSelected * 0.22);
  vec3 lit = enamel * (0.30 + diffuse * 0.66) + vec3(specular);
  gl_FragColor = vec4(lit, 1.0);
}
`;

function multiply4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function identity4(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function translation4(x: number, y: number, z: number): Float32Array {
  const out = identity4();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function rotationZ4(angle: number): Float32Array {
  const out = identity4();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c;
  out[1] = s;
  out[4] = -s;
  out[5] = c;
  return out;
}

function scale4(x: number, y: number, z: number): Float32Array {
  const out = identity4();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function orthographic4(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
  const out = identity4();
  out[0] = 2 / (right - left);
  out[5] = 2 / (top - bottom);
  out[10] = -2 / (far - near);
  out[12] = -(right + left) / (right - left);
  out[13] = -(top + bottom) / (top - bottom);
  out[14] = -(far + near) / (far - near);
  return out;
}

function rotationX4(angle: number): Float32Array {
  const out = identity4();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function addLathe(
  target: number[],
  profile: readonly [number, number][],
  segments: number,
  width: number,
  depth: number,
  offsetX = 0,
  offsetZ = 0,
  cuspStrength = 0,
): void {
  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    const [radiusA, yA] = profile[ring];
    const [radiusB, yB] = profile[ring + 1];
    const slope = (radiusB - radiusA) / (yB - yA || 1);
    for (let segment = 0; segment < segments; segment += 1) {
      const a0 = (segment / segments) * Math.PI * 2;
      const a1 = ((segment + 1) / segments) * Math.PI * 2;
      const normal0 = normalize3(Math.cos(a0), -slope, Math.sin(a0));
      const normal1 = normalize3(Math.cos(a1), -slope, Math.sin(a1));
      const point = (angle: number, radius: number, y: number): [number, number, number] => {
        const cusp = 1 + Math.cos(angle * 4) * cuspStrength * Math.max(0, (y - 0.18) / 0.46);
        return [
          offsetX + Math.cos(angle) * radius * width * cusp,
          y,
          offsetZ + Math.sin(angle) * radius * depth * cusp,
        ];
      };
      const p00 = point(a0, radiusA, yA);
      const p01 = point(a1, radiusA, yA);
      const p10 = point(a0, radiusB, yB);
      const p11 = point(a1, radiusB, yB);
      const triangle = (p: [number, number, number], n: [number, number, number]) => target.push(...p, ...n);
      triangle(p00, normal0);
      triangle(p10, normal0);
      triangle(p01, normal1);
      triangle(p01, normal1);
      triangle(p10, normal0);
      triangle(p11, normal1);
    }
  }
}

/** Generates a closed, shaded crown and one to three distinct tapered roots. */
export function buildToothMesh(rootCount: number, widthScale = 1): ToothMesh {
  const safeRoots = Math.max(1, Math.min(3, Math.round(rootCount)));
  const vertices: number[] = [];
  const crown: [number, number][] = [
    [0.19, -0.35], [0.27, -0.22], [0.34, -0.03], [0.39, 0.17],
    [0.36, 0.36], [0.28, 0.51], [0.15, 0.59], [0.035, 0.62],
  ];
  addLathe(vertices, crown, 28, widthScale, 0.78, 0, 0, 0.16);

  const rootOffsets: Array<[number, number]> = safeRoots === 1
    ? [[0, 0]]
    : safeRoots === 2
      ? [[-0.115, 0.015], [0.115, -0.015]]
      : [[-0.13, 0.105], [0.13, 0.105], [0, -0.15]];
  const rootProfile: [number, number][] = [
    [0.13, -0.27], [0.115, -0.43], [0.085, -0.65], [0.052, -0.86], [0.012, -1.04],
  ];
  for (const [x, z] of rootOffsets) {
    addLathe(vertices, rootProfile, 18, widthScale * 0.96, 0.66, x, z);
  }
  return { data: new Float32Array(vertices), vertexCount: vertices.length / 6 };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader allocation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('WebGL program allocation failed');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown shader link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function toothWidth(toothNumber: number): number {
  const position = toothNumber % 10;
  if (position <= 2) return 0.70;
  if (position === 3) return 0.76;
  if (position <= 5) return 0.84;
  return 1;
}

function statusRgb(status?: string): [number, number, number] {
  const value = (status ? STATUS_META[status as keyof typeof STATUS_META]?.color : undefined) || '#F3E9CE';
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) return [0.95, 0.91, 0.81];
  const hex = match[1];
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function makePoints(upperTeeth: readonly number[], lowerTeeth: readonly number[]): ToothPoint[] {
  const points: ToothPoint[] = [];
  const addArch = (teeth: readonly number[], upper: boolean) => {
    const count = teeth.length;
    const span = count < 16 ? 5.6 : 7.1;
    teeth.forEach((tooth, index) => {
      const normalized = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
      const curve = Math.cos(normalized * Math.PI / 2);
      points.push({
        tooth,
        x: normalized * span,
        y: (upper ? 1 : -1) * (0.16 + curve * 1.38),
        upper,
      });
    });
  };
  addArch(upperTeeth, true);
  addArch(lowerTeeth, false);
  return points;
}

export function OdontogramWebGL({
  upperTeeth,
  lowerTeeth,
  patientTeeth,
  selectedTooth,
  onToothClick,
}: OdontogramWebGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<ToothPoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false });
    } catch {
      gl = null;
    }
    if (!gl) {
      setState('unsupported');
      return;
    }

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch {
      setState('unsupported');
      return;
    }

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const normalLocation = gl.getAttribLocation(program, 'aNormal');
    const viewProjectionLocation = gl.getUniformLocation(program, 'uViewProjection');
    const modelLocation = gl.getUniformLocation(program, 'uModel');
    const colorLocation = gl.getUniformLocation(program, 'uColor');
    const selectedLocation = gl.getUniformLocation(program, 'uSelected');
    if (
      positionLocation < 0 || normalLocation < 0 ||
      !viewProjectionLocation || !modelLocation || !colorLocation || !selectedLocation
    ) {
      gl.deleteProgram(program);
      setState('unsupported');
      return;
    }

    const meshCache = new Map<string, { buffer: WebGLBuffer; vertexCount: number }>();
    const points = makePoints(upperTeeth, lowerTeeth);
    pointsRef.current = points;
    const viewProjection = multiply4(
      orthographic4(-8.45, 8.45, -4.2, 4.2, -12, 12),
      rotationX4(-0.13),
    );

    const draw = () => {
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl!.viewport(0, 0, width, height);
      gl!.clearColor(0.025, 0.045, 0.065, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
      gl!.enable(gl!.DEPTH_TEST);
      gl!.depthFunc(gl!.LEQUAL);
      gl!.useProgram(program);
      gl!.uniformMatrix4fv(viewProjectionLocation, false, viewProjection);

      for (const point of points) {
        const tooth = normalizeTooth(patientTeeth[point.tooth] ?? patientTeeth[String(point.tooth)]);
        const roots = Math.max(1, Math.min(3, getToothMorphology(point.tooth)?.roots || 1));
        const widthScale = toothWidth(point.tooth);
        const cacheKey = `${roots}:${widthScale}`;
        let mesh = meshCache.get(cacheKey);
        if (!mesh) {
          const generated = buildToothMesh(roots, widthScale);
          const buffer = gl!.createBuffer();
          if (!buffer) continue;
          gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
          gl!.bufferData(gl!.ARRAY_BUFFER, generated.data, gl!.STATIC_DRAW);
          mesh = { buffer, vertexCount: generated.vertexCount };
          meshCache.set(cacheKey, mesh);
        }
        const angle = point.x / 7.2 * 0.23 * (point.upper ? -1 : 1);
        const orientation = scale4(1, point.upper ? -1 : 1, 1);
        const model = multiply4(
          translation4(point.x, point.y, Math.abs(point.x) < 2 ? 0.08 : 0),
          multiply4(rotationZ4(angle), orientation),
        );
        const rgb = statusRgb(tooth.status);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, mesh.buffer);
        gl!.enableVertexAttribArray(positionLocation);
        gl!.enableVertexAttribArray(normalLocation);
        gl!.vertexAttribPointer(positionLocation, 3, gl!.FLOAT, false, 24, 0);
        gl!.vertexAttribPointer(normalLocation, 3, gl!.FLOAT, false, 24, 12);
        gl!.uniformMatrix4fv(modelLocation, false, model);
        gl!.uniform3f(colorLocation, rgb[0], rgb[1], rgb[2]);
        gl!.uniform1f(selectedLocation, selectedTooth === point.tooth ? 1 : 0);
        gl!.drawArrays(gl!.TRIANGLES, 0, mesh.vertexCount);
      }
    };

    setState('ready');
    draw();
    window.addEventListener('resize', draw);
    return () => {
      window.removeEventListener('resize', draw);
      meshCache.forEach((mesh) => gl!.deleteBuffer(mesh.buffer));
      gl!.deleteProgram(program);
    };
  }, [upperTeeth, lowerTeeth, patientTeeth, selectedTooth]);

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 16.9 - 8.45;
    const y = (0.5 - (event.clientY - rect.top) / rect.height) * 8.4;
    const nearest = pointsRef.current.reduce<{ point: ToothPoint; distance: number } | null>((best, point) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      return !best || distance < best.distance ? { point, distance } : best;
    }, null);
    if (nearest) onToothClick(nearest.point.tooth);
  };

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full max-w-[920px] overflow-hidden rounded-xl border border-cyan-400/15 bg-slate-950/80">
        <canvas
          ref={canvasRef}
          className="block h-[300px] w-full sm:h-[350px] md:h-[390px]"
          role="img"
          aria-label="Интерактивная трёхмерная WebGL-модель зубных дуг; выберите зуб мышью или с клавиатуры"
          onClick={handleCanvasClick}
          data-testid="odontogram-webgl-canvas"
        />
        {state === 'unsupported' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/95 p-5 text-center">
            <p className="m-0 text-sm font-semibold text-white">WebGL недоступен в этом браузере</p>
            <p className="m-0 max-w-md text-xs text-slate-300">Откройте клинический 2D-режим или выберите зуб из доступного списка ниже.</p>
          </div>
        )}
        {state === 'loading' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-slate-300">
            Подготовка 3D-модели зубных дуг…
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-cyan-300/20 bg-slate-950/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-cyan-100">
          WEBGL · FDI · {upperTeeth.length + lowerTeeth.length} ЗУБОВ
        </div>
      </div>
      <div className="sr-only" aria-label="Выбор зуба по номеру">
        {[...upperTeeth, ...lowerTeeth].map((toothNumber) => {
          const tooth = normalizeTooth(patientTeeth[toothNumber] ?? patientTeeth[String(toothNumber)]);
          return (
            <button
              key={toothNumber}
              type="button"
              aria-label={`Зуб ${toothNumber} · ${tooth.status || 'healthy'}`}
              aria-pressed={selectedTooth === toothNumber}
              onClick={() => onToothClick(toothNumber)}
            >
              {toothNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
