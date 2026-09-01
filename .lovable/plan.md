# Multiple named Topo areas

Today a floor has one outer `boundary`, a shared list of `exclusions`, one point list, and one High/Low/Δ pill computed over everything. This plan turns "the boundary" into "a list of areas", each with its own contour surface and its own High/Low/Δ, while keeping exclusions and the freshly shipped High/Low exclusion-scoping behaving exactly as they do now.

## What changes for you

- In Setup, the Boundary step becomes an **Areas** step. Drawing works exactly like exclusion zones do today: tap to add vertices, drag vertices to adjust, close the shape. "Add area" creates Area 2, Area 3, …; each is renameable and deletable.
- An existing job's current boundary silently becomes **Area 1**, so nothing you've already surveyed changes.
- Points are assigned automatically by where they physically sit. No per-point tagging. A point inside no area still shows on the plan but contributes to no contour surface and no pill.
- Exclusion zones stay exactly as they are — one list per floor, drawn the same way. Each hole is applied to whichever area contains it, so a hole cut in Area 1 has no effect on Area 2's surface.
- Topo tab gets an **area selector**: "All areas" plus one entry per area.
  - Focused on one area: full behavior as today — color fill, contours, legend, that area's High/Low pins and pill.
  - "All areas": each area draws its own contour lines/pins, and each area gets its own High/Low/Δ pill anchored near that area. To avoid stacked, meaningless color legends across different elevation baselines, the combined view uses the existing "Contours on/off" setting — turn the fill off and you get a clean multi-area overview with per-area pills. No new combined-view mode is invented.

## Technical detail

**Types (`src/lib/types.ts`)**

```ts
export interface TopoArea {
  id: string;
  name: string;            // "Area 1"
  polygon: Array<{ x: number; y: number }>;
  createdAt: number;
}
```

Add `areas?: TopoArea[]` to `Floor`. Keep `boundary` in place as the legacy field. A single migration helper `getAreas(floor)` returns `floor.areas` when present, else `[{ id: 'legacy', name: 'Area 1', polygon: floor.boundary }]`. Every read goes through that helper, so no data rewrite or bundle-version bump is required; Setup writes `areas` the first time an area is edited, and keeps `boundary` mirrored to `areas[0].polygon` so exports/PDF and any other consumer keep working.

**Assignment (`src/lib/areas.ts`, new)**

- `areaOfPoint(p, areas)` — first area whose polygon contains the point (first match wins on overlap; areas are meant not to overlap).
- `pointsByArea(points, areas)` — `Map<areaId, SurveyPoint[]>`.
- `exclusionsForArea(area, exclusions)` — holes whose first vertex falls inside that area's polygon.
- Reuses `pointInPolygon` from `src/lib/exclusions.ts`; no duplicate geometry.

**Topo computation (`src/components/tabs/TopoTab.tsx`)**

- Replace the single `buildGrid(...)` memo with a memo returning `AreaTopo[]` = `{ area, grid, contours, hiLo }`, one per area with ≥3 assigned points. `buildGrid` itself is unchanged — it is called once per area with that area's polygon and that area's exclusion subset.
- The just-shipped High/Low scoping is preserved verbatim, only narrowed per area: `pointsOutsideExclusions(pointsInBoundary(pts, area.polygon), exclusionsForArea(area, floor.exclusions))`. Both call sites (`hiLo` for hit-testing and the pin draw in `renderTopoTop`) consume the same per-area result, so they can't drift apart again.
- `renderTopoBase` loops areas: fill + lines per area, then the existing exclusion cutout pass per area. `renderTopoTop` loops areas for pins/labels.
- Value ranges stay per-area — a 3 ft level change between halves never shares a color ramp.

**Legend and pills**

- Legend renders only in single-area focus (it describes one value range). In "All areas" it is suppressed, and the existing "Contours on/off" toggle is the intended control for hiding fill.
- `StatsChip` becomes repeatable: one instance per area in the combined view, positioned near the area's polygon centroid; single-area focus keeps today's single pill placement. Existing size stepper applies to all instances.
- `src/routes/projects.$id.tsx` currently filters StatsChip points against `activeFloor.boundary`; it switches to per-area point sets from `pointsByArea`.

**Setup (`src/components/tabs/SetupTab.tsx`)**

- Generalize the existing three-way tool state to `{ area: id } | { exclusion: … }`. The exclusion drafting/vertex-drag/delete code is already the right shape; the outer-boundary special case folds into it as "the area list".
- Area list UI mirrors the exclusion list: name, vertex count, delete. Deleting the last area is blocked.
- The Setup guard "draw the outer boundary first" becomes "draw at least one area first".

**Not in scope**

3D tab multi-area handling, PDF/export layout for multiple areas (it keeps rendering the current single composite canvas), and cross-area comparison stats. Flagging these as follow-ups.
