// Topo interpolation and contouring.
// v1: linear interpolation via Delaunay triangulation onto a raster grid,
// then contour lines via d3-contour marching squares.
// Points outside the boundary polygon are masked out.

import Delaunator from "delaunator";
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

// Barycentric coords helper
function bary(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  px: number, py: number,
) {
  const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denom) < 1e-12) return null;
  const w1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
  const w2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
  const w3 = 1 - w1 - w2;
  return [w1, w2, w3] as const;
}

export function buildGrid(
  points: SurveyPoint[],
  boundary: Array<{ x: number; y: number }>,
  targetCols = 160,
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

  const coords = new Float64Array(points.length * 2);
  points.forEach((p, i) => {
    coords[i * 2] = p.x;
    coords[i * 2 + 1] = p.y;
  });
  const del = new Delaunator(coords);
  const tri = del.triangles;

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
      // find triangle containing (px, py) — linear scan (fine for v1 grids)
      let v: number | null = null;
      for (let t = 0; t < tri.length; t += 3) {
        const ia = tri[t], ib = tri[t + 1], ic = tri[t + 2];
        const ax = coords[ia * 2], ay = coords[ia * 2 + 1];
        const bx = coords[ib * 2], by = coords[ib * 2 + 1];
        const cx = coords[ic * 2], cy = coords[ic * 2 + 1];
        const b = bary(ax, ay, bx, by, cx, cy, px, py);
        if (!b) continue;
        const [w1, w2, w3] = b;
        const eps = -1e-6;
        if (w1 >= eps && w2 >= eps && w3 >= eps) {
          v = w1 * points[ia].value + w2 * points[ib].value + w3 * points[ic].value;
          break;
        }
      }
      if (v === null) {
        // outside convex hull — nearest neighbor fallback
        let best = Infinity;
        let bestV = 0;
        for (const p of points) {
          const d = (p.x - px) ** 2 + (p.y - py) ** 2;
          if (d < best) { best = d; bestV = p.value; }
        }
        v = bestV;
      }
      values[idx] = v;
      mask[idx] = 1;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  return {
    values: smoothGrid(values, mask, cols, rows, 3),
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

// Mask-aware box blur repeated N times ≈ Gaussian. Skips NaN cells outside boundary.
function smoothGrid(
  values: Float64Array,
  mask: Uint8Array,
  w: number,
  h: number,
  passes: number,
): Float64Array {
  let src = values;
  let dst = new Float64Array(values.length);
  for (let p = 0; p < passes; p++) {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (!mask[i]) { dst[i] = NaN; continue; }
        let sum = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr >= h || cc < 0 || cc >= w) continue;
            const j = rr * w + cc;
            if (!mask[j]) continue;
            sum += src[j];
            n++;
          }
        }
        dst[i] = n ? sum / n : src[i];
      }
    }
    const tmp = src; src = dst; dst = tmp;
  }
  return src;
}

export function computeContours(grid: Grid, interval: number) {
  // clean values array — replace NaN with a huge sentinel so contours ignore holes
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
