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

/** delta = manual override if set, else readingA − readingB. */
export function transitionDelta(t: Transition): number {
  return t.manualDeltaOverride ?? (t.readingA - t.readingB);
}

/** Corrected value used by topo/stats/export. Anchor keeps its stored value (already A-frame). */
export function correctedValue(
  p: SurveyPoint,
  transitions: readonly Transition[] | undefined,
): number {
  if (!p.transitionId || p.isTransitionAnchor) return p.value;
  const t = transitions?.find((x) => x.id === p.transitionId);
  if (!t) return p.value;
  return p.value + transitionDelta(t);
}

/** Returns a new array of points with `value` replaced by the corrected value. */
export function withCorrectedValues(
  points: readonly SurveyPoint[],
  transitions: readonly Transition[] | undefined,
): SurveyPoint[] {
  if (!transitions || transitions.length === 0) return points.slice();
  return points.map((p) => {
    const cv = correctedValue(p, transitions);
    return cv === p.value ? p : { ...p, value: cv };
  });
}

/** Format a signed delta like "+0.4" / "-0.4". Trims to 1 decimal for label brevity. */
export function formatDelta(d: number): string {
  const sign = d >= 0 ? "+" : "-";
  return `${sign}${Math.abs(d).toFixed(2)}`;
}

/** Short label for the transition chip / detail dialog: "Carpet correction +0.4"" */
export function transitionLabel(t: Transition): string {
  return `${t.surfaceB} correction ${formatDelta(transitionDelta(t))}"`;
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
