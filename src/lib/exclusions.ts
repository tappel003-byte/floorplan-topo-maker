// Exclusion zones — "holes" drawn inside the outer boundary.
// Topo skips cells inside them and drops the readings inside from the
// interpolator input. Readings are still shown on the plan and in Review.

import type { Exclusion, SurveyPoint } from "./types";

export function pointInPolygon(
  px: number,
  py: number,
  poly: Array<{ x: number; y: number }>,
): boolean {
  if (poly.length < 3) return false;
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

/** Return the first exclusion zone containing (x,y), or null. */
export function zoneOfXY(
  x: number,
  y: number,
  exclusions: Exclusion[] | undefined,
): Exclusion | null {
  if (!exclusions?.length) return null;
  for (const ex of exclusions) {
    if (pointInPolygon(x, y, ex.polygon)) return ex;
  }
  return null;
}

/** Map from point id → zone (for points inside any exclusion). */
export function computeExclusionMap(
  points: SurveyPoint[],
  exclusions: Exclusion[] | undefined,
): Map<string, Exclusion> {
  const m = new Map<string, Exclusion>();
  if (!exclusions?.length) return m;
  for (const p of points) {
    const z = zoneOfXY(p.x, p.y, exclusions);
    if (z) m.set(p.id, z);
  }
  return m;
}

/** Points not inside any exclusion. */
export function pointsOutsideExclusions(
  points: SurveyPoint[],
  exclusions: Exclusion[] | undefined,
): SurveyPoint[] {
  if (!exclusions?.length) return points;
  return points.filter((p) => !zoneOfXY(p.x, p.y, exclusions));
}

/** Draw hatched fill + solid outline for an exclusion polygon. */
export function drawExclusionShape(
  ctx: CanvasRenderingContext2D,
  polygon: Array<{ x: number; y: number }>,
  opts: { closed?: boolean; muted?: boolean } = {},
) {
  if (polygon.length === 0) return;
  const closed = opts.closed ?? true;
  const muted = opts.muted ?? false;

  ctx.save();
  ctx.beginPath();
  polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (closed && polygon.length > 2) ctx.closePath();

  // Base tint
  ctx.fillStyle = muted ? "rgba(107,114,128,0.10)" : "rgba(107,114,128,0.18)";
  if (closed && polygon.length > 2) ctx.fill();

  // Diagonal hatch pattern via a temporary offscreen tile
  if (closed && polygon.length > 2) {
    const tile = document.createElement("canvas");
    tile.width = 10;
    tile.height = 10;
    const tctx = tile.getContext("2d");
    if (tctx) {
      tctx.strokeStyle = muted ? "rgba(75,85,99,0.35)" : "rgba(75,85,99,0.55)";
      tctx.lineWidth = 1;
      tctx.beginPath();
      tctx.moveTo(-2, 12);
      tctx.lineTo(12, -2);
      tctx.moveTo(-2, 22);
      tctx.lineTo(22, -2);
      tctx.stroke();
      const pattern = ctx.createPattern(tile, "repeat");
      if (pattern) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pattern;
        const xs = polygon.map((p) => p.x);
        const ys = polygon.map((p) => p.y);
        const x0 = Math.min(...xs) - 4;
        const y0 = Math.min(...ys) - 4;
        const x1 = Math.max(...xs) + 4;
        const y1 = Math.max(...ys) + 4;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.restore();
      }
    }
  }

  ctx.strokeStyle = muted ? "rgba(75,85,99,0.55)" : "#4b5563";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
