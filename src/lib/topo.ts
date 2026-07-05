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
 * Fit a thin-plate spline through the given points. Returns f(x, y) → z.
 * Falls back to nearest-neighbor if the system is singular.
 */
function fitThinPlateSpline(
  points: SurveyPoint[],
): (x: number, y: number) => number {
  const n = points.length;
  const N = n + 3;
  const A = new Float64Array(N * N);
  const rhs = new Float64Array(N);
  const lambda = 1e-6; // tiny regularization for stability

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        A[i * N + j] = lambda;
      } else {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const r2 = dx * dx + dy * dy;
        A[i * N + j] = r2 > 0 ? 0.5 * r2 * Math.log(r2) : 0;
      }
    }
    A[i * N + n] = 1;
    A[i * N + n + 1] = points[i].x;
    A[i * N + n + 2] = points[i].y;
    rhs[i] = points[i].value;
  }
  for (let i = 0; i < n; i++) {
    A[n * N + i] = 1;
    A[(n + 1) * N + i] = points[i].x;
    A[(n + 2) * N + i] = points[i].y;
  }

  const sol = solveLinearSystem(A, rhs, N);
  if (!sol) {
    return (x, y) => {
      let best = Infinity, v = 0;
      for (const p of points) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < best) { best = d; v = p.value; }
      }
      return v;
    };
  }
  const w = sol.slice(0, n);
  const a0 = sol[n], a1 = sol[n + 1], a2 = sol[n + 2];

  return (x, y) => {
    let s = a0 + a1 * x + a2 * y;
    for (let i = 0; i < n; i++) {
      const dx = x - points[i].x;
      const dy = y - points[i].y;
      const r2 = dx * dx + dy * dy;
      if (r2 > 0) s += w[i] * 0.5 * r2 * Math.log(r2);
    }
    return s;
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

  const evaluate = fitThinPlateSpline(points);

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
