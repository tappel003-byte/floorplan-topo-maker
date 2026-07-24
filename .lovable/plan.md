## Problem

On the Topo tab, contours near the boundary edge look pulled toward readings that sit *outside* the boundary. Cause: `buildGrid()` in `src/lib/topo.ts` filters points against exclusion polygons but not against the boundary itself. Every reading — even ones outside the drawn boundary — is fed into the TPS surface. Only the *rendered cells* are masked to the boundary, so outside points still bend the surface right up to the edge.

Effect the user is seeing: when they shrink the boundary to just the 1910 structure, the added-on readings are still influencing the contours along that new edge.

## Change

One narrow fix in `src/lib/topo.ts › buildGrid()`:

- After filtering out points inside any exclusion polygon, also drop points that fall outside the `boundary` polygon before fitting the TPS / IDW surface.
- Everything else (grid sizing, masking, contour math, clamping) stays as-is.

Result: redrawing the boundary immediately re-tops the plan using only the readings inside it. Points outside the boundary still render on the plan (they're not deleted) but no longer influence the interpolated surface.

No UI changes, no data migration, no changes to Field/Review/Export.

## Technical note

`pointInPolygon` already exists in the file. The active-point filter becomes:

```text
activePoints = points
  .filter(p => pointInPolygon(p.x, p.y, boundary))
  .filter(p => !excl.some(poly => pointInPolygon(p.x, p.y, poly)))
```

Guard: if the filter leaves fewer than 3 points, `buildGrid` returns `null` (same "not enough points" path already handled by TopoTab's `canRender` warning).
