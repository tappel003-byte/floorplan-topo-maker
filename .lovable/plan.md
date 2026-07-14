# Exclusion Zones

Add "excluded areas" to a floor — polygons drawn inside the outer boundary that the topo engine treats as holes. Readings taken inside an exclusion still plot on the plan, still show their value, still appear in Data/Review — they just don't influence the contour surface and aren't counted in stats by default.

Typical uses: garage slab (intentional drainage slope), sunken living room, raised hearth, flooring change the surveyor wants tracked but not topo'd.

## Data model

Add to `Floor` in `src/lib/types.ts`:

```ts
exclusions?: Array<{
  id: string;
  label?: string;         // "Garage", "Sunken LR"
  polygon: { x: number; y: number }[];  // same coordinate space as boundary
  createdAt: number;
}>;
```

On each `SurveyPoint`, add `excludedByZoneId?: string` — recomputed whenever exclusions or point positions change. Not user-editable; derived state persisted for fast filtering.

## Setup tab

After the outer boundary is closed, a second tool becomes available: **Add excluded area**. Same tap-corners-then-close interaction as the boundary tool.

- Rendered as a hatched fill with a solid outline so it reads as "hole," not "region."
- Optional label input on completion (defaults to "Excluded 1", "Excluded 2", …).
- List of existing exclusions below the tool, each with rename / delete / edit-vertices (reuse the boundary vertex-drag we already have).
- Multiple exclusions per floor, independent of each other.

When an exclusion is added, edited, or deleted, sweep all points on the floor and update `excludedByZoneId`. Points that entered a new zone get tagged; points that left a deleted/resized zone get untagged. Point-in-polygon test via standard ray-cast.

## Field tab

No new controls. Points dropped inside an exclusion are auto-tagged on save (same point-in-polygon check). The pin renders normally so the user always sees their reading. A small muted label — e.g. "Garage" — sits next to the elevation value so the exclusion is legible on the plan.

Undo already covers "I drew the polygon wrong" — deleting or resizing the exclusion re-runs the sweep and untags the points.

## Topo tab

Two changes in `src/lib/topo.ts` / `TopoTab.tsx`:

1. Any grid cell whose center falls inside any exclusion polygon is marked no-data — no color fill, no contour line drawn through it.
2. Excluded points are removed from the input set fed to the interpolator, so the surface around a garage isn't dragged by garage readings.

The exclusion polygon itself is drawn on top of the topo as the same hatched shape from Setup, so viewers understand *why* there's a gap. The legend is unchanged.

## Review, Stats, Export

- **Review table:** new column "Zone" showing the exclusion label (blank for included points). Sortable. Existing sorts unchanged.
- **StatsChip / TopoDiagnosticPanel:** excluded points are dropped from High/Low/Delta by default. Add one toggle "Include excluded points in stats" for parity with the existing diagnostic exclusions.
- **CSV export:** add a `zone` column.
- **Bundle export/import:** `exclusions` and `excludedByZoneId` ride along in the existing project bundle — no schema break for old files (both fields optional).

## Files touched

- `src/lib/types.ts` — `Floor.exclusions`, `SurveyPoint.excludedByZoneId`
- `src/lib/topo.ts` — cell mask + input filter
- `src/lib/transitions.ts` — no change (exclusion is independent of transitions)
- `src/components/tabs/SetupTab.tsx` — new tool, list, vertex editing
- `src/components/tabs/FieldTab.tsx` — auto-tag on save, small zone label near pin
- `src/components/tabs/TopoTab.tsx` — draw hatched overlays, pass filtered points
- `src/components/tabs/ReviewTab.tsx` — Zone column
- `src/components/chrome/StatsChip.tsx` + `TopoDiagnosticPanel.tsx` — exclude-from-stats toggle
- `src/lib/bundle.ts` / `src/lib/pdf.ts` — CSV/PDF include zone
- `src/lib/db.ts` — no schema bump needed (extra optional fields)

## Open questions I'm assuming answers to

- Exclusions can overlap the outer boundary edge (e.g. an attached garage that shares a wall) — the point-in-polygon test handles this fine.
- No nested exclusions (exclusion inside an exclusion). If that ever comes up, treat inner as re-included; not implementing now.
- Draw order in Setup: outer boundary must exist before exclusions can be drawn. Deleting the outer boundary keeps exclusions but grays out the tool until it's redrawn.
