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
  opts: { closed?: boolean; muted?: boolean; hatched?: boolean } = {},
) {
  if (polygon.length === 0) return;
  const closed = opts.closed ?? true;
  const muted = opts.muted ?? false;
  const hatched = opts.hatched ?? false;

  ctx.save();
  ctx.beginPath();
  polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (closed && polygon.length > 2) ctx.closePath();

  // Solid white fill masks the topo surface underneath — but only when we're
  // NOT drawing the hatched Setup preview. Hatched mode stays transparent so
  // the plan reads through.
  if (!hatched && closed && polygon.length > 2) {
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // Transparent diagonal cross-hatch for the Setup tab preview.
  if (hatched && closed && polygon.length > 2) {
    ctx.save();
    ctx.beginPath();
    polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const spacing = 16;
    ctx.strokeStyle = "rgba(75,85,99,0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    const w = maxX - minX;
    const h = maxY - minY;
    // Two crossing sets of diagonals.
    for (let d = -h; d <= w + h; d += spacing) {
      ctx.beginPath();
      ctx.moveTo(minX + d, minY);
      ctx.lineTo(minX + d + h, maxY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(minX + d, maxY);
      ctx.lineTo(minX + d + h, minY);
      ctx.stroke();
    }
    ctx.restore();
  }


  // Clean outline border.
  ctx.strokeStyle = muted ? "#9ca3af" : "#4b5563";
  ctx.lineWidth = muted ? 1.5 : 2;
  ctx.setLineDash([]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

