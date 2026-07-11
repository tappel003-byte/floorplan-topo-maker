// Topo interpolation and contouring.
// Uses a minimum-curvature-style relaxation grid seeded by inverse-distance
// weighting, with survey readings held as fixed control cells.

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
  const fixed = new Uint8Array(cols * rows);
  let minV = Infinity;
  let maxV = -Infinity;

  // Seed the surface with inverse-distance weighting so relaxation starts from
  // a smooth surface rather than a triangulation.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = minX + c * step;
      const py = minY + r * step;
      const idx = r * cols + c;
      if (!pointInPolygon(px, py, boundary)) {
        values[idx] = NaN;
        continue;
      }
      let numerator = 0;
      let denominator = 0;
      for (const p of points) {
        const d2 = (p.x - px) ** 2 + (p.y - py) ** 2;
        const weight = 1 / Math.max(d2, 1e-6);
        numerator += p.value * weight;
        denominator += weight;
      }
      values[idx] = numerator / denominator;
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
      fixed[idx] = 1;
    }
  }

  const relaxed = relaxMinimumCurvature(values, mask, fixed, cols, rows, 600);

  for (let i = 0; i < relaxed.length; i++) {
    if (!mask[i]) continue;
    const v = relaxed[i];
    if (Number.isFinite(v)) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  return {
    values: relaxed,
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

function relaxMinimumCurvature(
  values: Float64Array,
  mask: Uint8Array,
  fixed: Uint8Array,
  w: number,
  h: number,
  iterations: number,
): Float64Array {
  let src: Float64Array = values;
  let dst: Float64Array = new Float64Array(values.length);
  const omega = 0.58;
  for (let pass = 0; pass < iterations; pass++) {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (!mask[i]) {
          dst[i] = NaN;
          continue;
        }
        if (fixed[i]) {
          dst[i] = values[i];
          continue;
        }
        let sum = 0;
        let n = 0;
        const neighbors = [i - 1, i + 1, i - w, i + w];
        for (const j of neighbors) {
          if (j < 0 || j >= src.length || !mask[j]) continue;
          if ((j === i - 1 && c === 0) || (j === i + 1 && c === w - 1)) continue;
          sum += src[j];
          n++;
        }
        if (!n) {
          dst[i] = src[i];
        } else {
          const average = sum / n;
          dst[i] = src[i] + omega * (average - src[i]);
          if (!Number.isFinite(dst[i])) dst[i] = src[i];
        }
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }
  return src;
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
  // Snap the first contour to the nearest tenth at or above the data min.
  // Data is entered in tenths, so contour levels should always land on tenths.
  const first = options.first ?? Math.ceil(min * 10 - 1e-6) / 10;
  const count =
    options.count && options.count > 0 ? options.count : Math.ceil((max - first) / step) + 1;
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
