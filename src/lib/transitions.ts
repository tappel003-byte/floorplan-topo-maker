// Flooring transition helpers — pure functions. See mem://features/transitions-spec-locked.

import type { SurveyPoint, Transition } from "./types";

/** Common flooring surfaces in the surface dropdowns. Extendable via "Other". */
export const COMMON_SURFACES = [
  "Tile",
  "Carpet",
  "Hardwood",
  "LVP",
  "Vinyl",
  "Laminate",
  "Concrete",
  "Stone",
  "Other",
] as const;

/** Canonical key for grouping transitions by surface pair. */
export function transitionGroupKey(t: Pick<Transition, "surfaceA" | "surfaceB">): string {
  return `${t.surfaceA}→${t.surfaceB}`;
}

/**
 * delta priority:
 *   1. manual per-doorway override, if set
 *   2. per-surface-pair applied average, if set
 *   3. measured readingA − readingB
 */
export function transitionDelta(
  t: Transition,
  groupAverages?: Record<string, number>,
): number {
  if (t.manualDeltaOverride !== undefined) return t.manualDeltaOverride;
  const avg = groupAverages?.[transitionGroupKey(t)];
  if (avg !== undefined) return avg;
  return t.readingA - t.readingB;
}

/** Corrected value used by topo/stats/export. Anchor keeps its stored value (already A-frame). */
export function correctedValue(
  p: SurveyPoint,
  transitions: readonly Transition[] | undefined,
  groupAverages?: Record<string, number>,
): number {
  if (!p.transitionId || p.isTransitionAnchor) return p.value;
  const t = transitions?.find((x) => x.id === p.transitionId);
  if (!t) return p.value;
  return p.value + transitionDelta(t, groupAverages);
}

/** Returns a new array of points with `value` replaced by the corrected value. */
export function withCorrectedValues(
  points: readonly SurveyPoint[],
  transitions: readonly Transition[] | undefined,
  groupAverages?: Record<string, number>,
): SurveyPoint[] {
  if (!transitions || transitions.length === 0) return points.slice();
  return points.map((p) => {
    const cv = correctedValue(p, transitions, groupAverages);
    return cv === p.value ? p : { ...p, value: cv };
  });
}

/** Format a signed delta like "+0.4" / "-0.4". Trims to 1 decimal for label brevity. */
export function formatDelta(d: number): string {
  const sign = d >= 0 ? "+" : "-";
  return `${sign}${Math.abs(d).toFixed(2)}`;
}

/** Short label for the transition chip / detail dialog: "Carpet correction +0.4"" */
export function transitionLabel(t: Transition, groupAverages?: Record<string, number>): string {
  return `${t.surfaceB} correction ${formatDelta(transitionDelta(t, groupAverages))}"`;
}

/** Surface-focused correction label: "Carpet correction". */
export function correctionLabel(surface: string): string {
  return `${surface || "Surface"} correction`;
}

/**
 * Walks parentId up to the chain root and returns the root's surfaceA — the
 * baseline surface every correction in the chain resolves back to.
 */
export function getChainBaselineSurface(
  transitionId: string | null | undefined,
  transitions: readonly Transition[] | undefined,
): string | null {
  if (!transitionId || !transitions?.length) return null;
  const byId = new Map(transitions.map((t) => [t.id, t]));
  let cur = byId.get(transitionId);
  const seen = new Set<string>();
  while (cur?.parentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    const p = byId.get(cur.parentId);
    if (!p) break;
    cur = p;
  }
  return cur?.surfaceA ?? null;
}

/** One surface-pair group for the Transitions sheet. */
export interface TransitionGroup {
  key: string;
  surfaceA: string;
  surfaceB: string;
  transitions: Transition[];
  /** Mean of raw measured deltas (readingA − readingB) in this group. */
  measuredAverage: number;
  /** Number of points (excluding anchors) referencing any transition in this group. */
  affectedPointCount: number;
}

/** Group every transition on the floor by canonical surface pair. */
export function groupTransitionsBySurfacePair(
  transitions: readonly Transition[] | undefined,
  points: readonly SurveyPoint[] | undefined,
): TransitionGroup[] {
  if (!transitions?.length) return [];
  const byKey = new Map<string, TransitionGroup>();
  for (const t of transitions) {
    const key = transitionGroupKey(t);
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        surfaceA: t.surfaceA,
        surfaceB: t.surfaceB,
        transitions: [],
        measuredAverage: 0,
        affectedPointCount: 0,
      };
      byKey.set(key, g);
    }
    g.transitions.push(t);
  }
  const idToKey = new Map(transitions.map((t) => [t.id, transitionGroupKey(t)]));
  const affectedByKey = new Map<string, number>();
  for (const p of points ?? []) {
    if (!p.transitionId || p.isTransitionAnchor) continue;
    const k = idToKey.get(p.transitionId);
    if (!k) continue;
    affectedByKey.set(k, (affectedByKey.get(k) ?? 0) + 1);
  }
  for (const g of byKey.values()) {
    const rawDeltas = g.transitions.map((t) => t.readingA - t.readingB);
    g.measuredAverage =
      rawDeltas.reduce((s, v) => s + v, 0) / (rawDeltas.length || 1);
    g.affectedPointCount = affectedByKey.get(g.key) ?? 0;
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}
