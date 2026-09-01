// Topo areas — a floor can be divided into several independent survey areas.
// Each area has its own boundary polygon, its own contour surface, and its own
// High / Low / Δ stats. Points are assigned automatically by geometry: a point
// belongs to the first area whose polygon contains it.
//
// Legacy floors have a single `boundary` and no `areas`; getAreas() presents
// that boundary as "Area 1" so every reader can assume an array of areas.

import { pointInPolygon } from "./exclusions";
import type { Exclusion, Floor, SurveyPoint, TopoArea } from "./types";

export const LEGACY_AREA_ID = "legacy";

/** Areas for a floor, falling back to the legacy single boundary. */
export function getAreas(floor: Pick<Floor, "areas" | "boundary">): TopoArea[] {
  const areas = floor.areas?.filter((a) => a.polygon.length >= 3);
  if (areas && areas.length) return areas;
  if (floor.boundary && floor.boundary.length >= 3) {
    return [
      { id: LEGACY_AREA_ID, name: "Area 1", polygon: floor.boundary, createdAt: 0 },
    ];
  }
  return [];
}

/**
 * Write areas onto a floor, keeping `boundary` mirrored to the first area so
 * legacy consumers (export, PDF, 3D) keep working without a data migration.
 */
export function withAreas(floor: Floor, areas: TopoArea[]): Floor {
  return { ...floor, areas, boundary: areas[0]?.polygon ?? [] };
}

/** First area containing (x, y), or null. Areas are not meant to overlap. */
export function areaOfPoint(
  p: { x: number; y: number },
  areas: TopoArea[],
): TopoArea | null {
  for (const a of areas) {
    if (a.polygon.length >= 3 && pointInPolygon(p.x, p.y, a.polygon)) return a;
  }
  return null;
}

/** Points physically inside one area. */
export function pointsInArea(points: SurveyPoint[], area: TopoArea): SurveyPoint[] {
  if (area.polygon.length < 3) return [];
  return points.filter((p) => pointInPolygon(p.x, p.y, area.polygon));
}

/** Points grouped by area id. Points inside no area are omitted. */
export function pointsByArea(
  points: SurveyPoint[],
  areas: TopoArea[],
): Map<string, SurveyPoint[]> {
  const m = new Map<string, SurveyPoint[]>();
  for (const a of areas) m.set(a.id, []);
  for (const p of points) {
    const a = areaOfPoint(p, areas);
    if (a) m.get(a.id)!.push(p);
  }
  return m;
}

/** Points inside any area (union). Used for whole-floor stats. */
export function pointsInAnyArea(points: SurveyPoint[], areas: TopoArea[]): SurveyPoint[] {
  if (!areas.length) return points;
  return points.filter((p) => !!areaOfPoint(p, areas));
}

/** Exclusion holes belonging to one area (first vertex inside the area). */
export function exclusionsForArea(
  area: TopoArea,
  exclusions: Exclusion[] | undefined,
): Exclusion[] {
  if (!exclusions?.length || area.polygon.length < 3) return [];
  return exclusions.filter(
    (e) => e.polygon.length >= 3 && pointInPolygon(e.polygon[0].x, e.polygon[0].y, area.polygon),
  );
}

/** Average of the polygon vertices — good enough for anchoring a label. */
export function areaCentroid(area: TopoArea): { x: number; y: number } {
  if (!area.polygon.length) return { x: 0, y: 0 };
  const sx = area.polygon.reduce((s, p) => s + p.x, 0);
  const sy = area.polygon.reduce((s, p) => s + p.y, 0);
  return { x: sx / area.polygon.length, y: sy / area.polygon.length };
}
