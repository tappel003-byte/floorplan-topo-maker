// Topo interpolation and contouring.
// Smooth IDW surface (Shepard's method) so contour lines are curved, not
// triangulated. At each measured point the surface collapses to the exact
// reading, so peaks/troughs stay sharp enough to produce the expected number
// of intermediate contours between neighboring readings.

import { contours } from "d3-contour";
import type { SurveyPoint } from "./types";

export interface Grid {
  values: Float64Array;
  mask: Uint8Array; // 1 = inside boundary
  width: number;
  height: number;
  minValue: number;
  maxValue: number;
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
  const minV = Math.min(...points.map((p) => p.value));
  const maxV = Math.max(...points.map((p) => p.value));

  // Shepard IDW with power 2 → smooth curved contours. At a measured point
  // d→0 collapses to that exact value so peaks/troughs remain sharp.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = minX + c * step;
      const py = minY + r * step;
      const idx = r * cols + c;
      if (!pointInPolygon(px, py, boundary)) {
        values[idx] = NaN;
        continue;
      }
      values[idx] = interpolateIdw(px, py, points, 2);
      mask[idx] = 1;
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

function interpolateIdw(x: number, y: number, points: SurveyPoint[], power = 2) {
  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < 1e-6) return p.value;
    const weight = 1 / Math.pow(d2, power / 2);
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
  const first = options.first ?? Math.ceil((min - 1e-6) / step) * step;
  const count =
    options.count && options.count > 0 ? options.count : Math.floor((max - first + 1e-6) / step) + 1;
  const thresholds: number[] = [];
  for (let i = 0; i < count; i++) {
    thresholds.push(Math.round((first + i * step) * 1000) / 1000);
  }
  return thresholds.filter((v) => v >= min - 1e-6 && v <= max + 1e-6);
}

export function computeContours(grid: Grid, options: ContourOptions | number) {
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
