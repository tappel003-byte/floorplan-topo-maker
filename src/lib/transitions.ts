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

/** delta = readingA − readingB. Add to a raw B-side reading to get the A-frame value. */
export function transitionDelta(t: Transition): number {
  return t.readingA - t.readingB;
}

/** Sum of deltas walking parentId → root. Converts a raw reading on the
 *  active transition's B-surface into the root reference frame. */
export function chainDelta(
  transitionId: string | undefined,
  transitions: readonly Transition[] | undefined,
): number {
  if (!transitionId || !transitions) return 0;
  let total = 0;
  let cur: Transition | undefined = transitions.find((t) => t.id === transitionId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    total += transitionDelta(cur);
    cur = cur.parentId ? transitions.find((t) => t.id === cur!.parentId) : undefined;
  }
  return total;
}

/** Corrected value used by topo/stats/export. Anchor keeps its stored value (already A-frame). */
export function correctedValue(
  p: SurveyPoint,
  transitions: readonly Transition[] | undefined,
): number {
  if (!p.transitionId || p.isTransitionAnchor) return p.value;
  return p.value + chainDelta(p.transitionId, transitions);
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
  return `${sign}${Math.abs(d).toFixed(1)}`;
}

/** Short label for the transition chip / detail dialog: "Tile → Carpet +0.4"" */
export function transitionLabel(t: Transition): string {
  return `${t.surfaceA} → ${t.surfaceB} ${formatDelta(transitionDelta(t))}"`;
}
