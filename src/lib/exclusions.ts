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

/** Draw an exclusion polygon as a clean white hole with a visible outline.
 *  The white fill masks underlying topo contours so excluded areas read as
 *  blank space, while the outline keeps the boundary legible.
 */
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

  // White fill — erases the interpolated topo surface underneath.
  ctx.fillStyle = "#ffffff";
  if (closed && polygon.length > 2) ctx.fill();

  // Clean outline border. Slightly thinner when muted so it doesn't fight
  // other editing chrome, but still solid for clarity.
  ctx.strokeStyle = muted ? "#9ca3af" : "#4b5563";
  ctx.lineWidth = muted ? 1.5 : 2;
  ctx.setLineDash([]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}
