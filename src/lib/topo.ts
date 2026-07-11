// Topo interpolation and contouring.
// Uses a TIN-style linear surface inside measured triangles, with IDW only for
// boundary areas outside the point hull. This keeps contours faithful between
// actual readings instead of smoothing peaks/lows away.

import { contours } from "d3-contour";
import Delaunator from "delaunator";
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
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function buildGrid(
  points: SurveyPoint[],
  boundary: Array<{ x: number; y: number }>,
  targetCols = 320,
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
  const step = Math.max(w, h) / targetCols;
  const cols = Math.max(2, Math.ceil(w / step));
  const rows = Math.max(2, Math.ceil(h / step));

  const values = new Float64Array(cols * rows);
  const mask = new Uint8Array(cols * rows);
  const pointCoords = points.map((p) => [p.x, p.y] as [number, number]);
  const delaunay = Delaunator.from(pointCoords);
  const triangles = buildTriangleIndex(points, delaunay.triangles);
  let minV = Math.min(...points.map((p) => p.value));
  let maxV = Math.max(...points.map((p) => p.value));

  // Build a measured surface. Inside a triangle, interpolate linearly between
  // the three readings. Outside the convex hull but still inside the room
  // boundary, fall back to IDW so the filled surface reaches the edges.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = minX + c * step;
      const py = minY + r * step;
      const idx = r * cols + c;
      if (!pointInPolygon(px, py, boundary)) {
        values[idx] = NaN;
        continue;
      }
      values[idx] = interpolateTin(px, py, triangles) ?? interpolateIdw(px, py, points);
      mask[idx] = 1;
    }
  }

  // Anchor each survey point to its single nearest grid cell. A single fixed
  // cell (rather than a disk) preserves the peak/trough exactly without
  // creating a plateau that swallows the gradient between neighboring points.
  // The high grid resolution + many relaxation iterations propagates the value
  // outward smoothly, giving room for the expected number of contours.
  for (const p of points) {
    const cc = Math.max(0, Math.min(cols - 1, Math.round((p.x - minX) / step)));
    const rc = Math.max(0, Math.min(rows - 1, Math.round((p.y - minY) / step)));
    const idx = rc * cols + cc;
    if (mask[idx]) {
      values[idx] = p.value;
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

interface TriangleSample {
  a: SurveyPoint;
  b: SurveyPoint;
  c: SurveyPoint;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function buildTriangleIndex(points: SurveyPoint[], triangles: Uint32Array | Int32Array) {
  const out: TriangleSample[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const a = points[triangles[i]];
    const b = points[triangles[i + 1]];
    const c = points[triangles[i + 2]];
    if (!a || !b || !c) continue;
    out.push({
      a,
      b,
      c,
      minX: Math.min(a.x, b.x, c.x),
      maxX: Math.max(a.x, b.x, c.x),
      minY: Math.min(a.y, b.y, c.y),
      maxY: Math.max(a.y, b.y, c.y),
    });
  }
  return out;
}

function interpolateTin(
  x: number,
  y: number,
  triangles: TriangleSample[],
): number | null {
  for (const t of triangles) {
    if (x < t.minX || x > t.maxX || y < t.minY || y > t.maxY) continue;
    const weights = barycentric(x, y, t.a, t.b, t.c);
    if (!weights) continue;
    const [wa, wb, wc] = weights;
    return wa * t.a.value + wb * t.b.value + wc * t.c.value;
  }
  return null;
}

function barycentric(
  x: number,
  y: number,
  a: SurveyPoint,
  b: SurveyPoint,
  c: SurveyPoint,
): [number, number, number] | null {
  const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(det) < 1e-9) return null;
  const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / det;
  const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / det;
  const wc = 1 - wa - wb;
  const eps = -1e-7;
  return wa >= eps && wb >= eps && wc >= eps ? [wa, wb, wc] : null;
}

function interpolateIdw(x: number, y: number, points: SurveyPoint[]) {
  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < 1e-6) return p.value;
    const weight = 1 / d2;
    numerator += p.value * weight;
    denominator += weight;
  }
  return numerator / denominator;
}

export interface ContourOptions {
  first?: number | null;
  step: number;
  count?: number;
  min?: number | null;
  max?: number | null;
}

export function contourThresholds(grid: Grid, options: ContourOptions) {
  const step = Math.max(0.01, options.step || 0.2);
  const min = options.min ?? grid.minValue;
  const max = options.max ?? grid.maxValue;
  // Snap automatic contours to the interval grid, not to the data minimum.
  // Example: min 9.30, max 10.30, step 0.20 => 9.40, 9.60, 9.80, 10.00, 10.20.
  const first = options.first ?? Math.ceil((min - 1e-6) / step) * step;
  const count =
    options.count && options.count > 0 ? options.count : Math.floor((max - first + 1e-6) / step) + 1;
  const thresholds: number[] = [];
  for (let i = 0; i < count; i++) {
    // Round to 3 decimals to avoid floating-point drift like 5.2000000001.
    thresholds.push(Math.round((first + i * step) * 1000) / 1000);
  }
  return thresholds.filter((v) => v >= min - 1e-6 && v <= max + 1e-6);
}

export function computeContours(grid: Grid, options: ContourOptions | number) {
  // clean values array — replace NaN with a huge sentinel so contours ignore holes
  const clean = new Float64Array(grid.values.length);
  for (let i = 0; i < clean.length; i++) {
    clean[i] = grid.mask[i] ? grid.values[i] : NaN;
  }
  const thresholds =
    typeof options === "number"
      ? contourThresholds(grid, { step: options })
      : contourThresholds(grid, options);

  const gen = contours().size([grid.width, grid.height]).thresholds(thresholds);
  return gen(Array.from(clean));
}

export function clampValue(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
