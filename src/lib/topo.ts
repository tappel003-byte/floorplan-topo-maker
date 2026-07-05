// Topo interpolation and contouring.
// Surface: thin-plate spline (TPS) — one smooth surface fit through all points,
// like a stretched rubber sheet. Contours computed via marching squares.
// Points outside the boundary polygon are masked out.

import { contours } from "d3-contour";
import type { SurveyPoint } from "./types";

export interface Grid {
  values: Float64Array;
  mask: Uint8Array; // 1 = inside boundary
  width: number;
  height: number;
  minValue: number;
  maxValue: number;
  // origin & step in image coords
  x0: number;
  y0: number;
  step: number;
}

function pointInPolygon(px: number, py: number, poly: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y,
      xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Solve A x = b in place using Gaussian elimination with partial pivoting.
 * A is n×n row-major (Float64Array length n*n). b is length n. Returns x
 * (same array as b, overwritten). Returns null if singular.
 */
function solveLinearSystem(A: Float64Array, b: Float64Array, n: number): Float64Array | null {
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    let maxVal = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i * n + k]);
      if (v > maxVal) { maxVal = v; maxRow = i; }
    }
    if (maxVal < 1e-12) return null;
    if (maxRow !== k) {
      for (let j = k; j < n; j++) {
        const tmp = A[k * n + j];
        A[k * n + j] = A[maxRow * n + j];
        A[maxRow * n + j] = tmp;
      }
      const tb = b[k]; b[k] = b[maxRow]; b[maxRow] = tb;
    }
    const pivot = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const factor = A[i * n + k] / pivot;
      if (factor === 0) continue;
      for (let j = k; j < n; j++) A[i * n + j] -= factor * A[k * n + j];
      b[i] -= factor * b[k];
    }
  }
  const x = b;
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) sum -= A[i * n + j] * x[j];
    x[i] = sum / A[i * n + i];
  }
  return x;
}

/**
 * Inverse-distance weighted interpolation. Smoother than piecewise-linear
 * but each point retains local influence, so real features don't get
 * flattened out. `power` controls locality: higher = more local character.
 */
function fitIDW(
  points: SurveyPoint[],
  power = 2.5,
): (x: number, y: number) => number {
  return (x, y) => {
    let num = 0;
    let den = 0;
    for (const p of points) {
      const dx = x - p.x;
      const dy = y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-6) return p.value; // sitting on a point
      const w = 1 / Math.pow(d2, power / 2);
      num += w * p.value;
      den += w;
    }
    return num / den;
  };
}


export function buildGrid(
  points: SurveyPoint[],
  boundary: Array<{ x: number; y: number }>,
  targetCols = 240,
): Grid | null {
  if (points.length < 3 || boundary.length < 3) return null;

  const xs = boundary.map((p) => p.x);
  const ys = boundary.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const step = w / targetCols;
  const cols = Math.max(2, Math.ceil(w / step));
  const rows = Math.max(2, Math.ceil(h / step));

  const evaluate = fitIDW(points, 2.5);

  const values = new Float64Array(cols * rows);
  const mask = new Uint8Array(cols * rows);
  let minV = Infinity;
  let maxV = -Infinity;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = minX + c * step;
      const py = minY + r * step;
      const idx = r * cols + c;
      if (!pointInPolygon(px, py, boundary)) {
        values[idx] = NaN;
        continue;
      }
      const v = evaluate(px, py);
      values[idx] = v;
      mask[idx] = 1;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  return {
    values,
    mask,
    width: cols,
    height: rows,
    minValue: isFinite(minV) ? minV : 0,
    maxValue: isFinite(maxV) ? maxV : 0,
    x0: minX,
    y0: minY,
    step,
  };
}

/**
 * Chaikin corner-cutting: smooths a polyline/ring by inserting two points per
 * segment at 1/4 and 3/4 positions. Kept for a tiny final polish on contour
 * rings; the TPS surface already produces smooth curves.
 */
export function chaikin(
  ring: Array<[number, number]>,
  iterations = 2,
  closed = true,
): Array<[number, number]> {
  if (ring.length < 3) return ring;
  let pts = ring;
  for (let it = 0; it < iterations; it++) {
    const out: Array<[number, number]> = [];
    const n = pts.length;
    const last = closed ? n : n - 1;
    if (!closed) out.push(pts[0]);
    for (let i = 0; i < last; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) out.push(pts[n - 1]);
    pts = out;
  }
  return pts;
}

export function computeContours(grid: Grid, interval: number) {
  const clean = new Float64Array(grid.values.length);
  for (let i = 0; i < clean.length; i++) {
    clean[i] = grid.mask[i] ? grid.values[i] : NaN;
  }
  const thresholds: number[] = [];
  const start = Math.floor(grid.minValue / interval) * interval;
  const end = Math.ceil(grid.maxValue / interval) * interval;
  for (let v = start; v <= end + 1e-9; v += interval) thresholds.push(v);

  const gen = contours().size([grid.width, grid.height]).thresholds(thresholds);
  return gen(Array.from(clean));
}
