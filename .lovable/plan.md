Add diagonal cross-hatch fill to exclusion zones on the Setup/Boundary tab only, and confirm saved exclusion vertices are drag-editable just like boundary vertices.

## Changes

1. `src/lib/exclusions.ts` — add optional `hatched?: boolean` to `drawExclusionShape`. When true, after the white fill and before the outline stroke, clip to the polygon and draw diagonal cross-hatch lines so the excluded region reads clearly. Default `false` keeps Topo (white + outline) and Data (no draw) untouched.

2. `src/components/tabs/SetupTab.tsx` — pass `hatched: true` to both `drawExclusionShape` calls (saved exclusions at line 622, live draft at line 659). Vertex handles are already drawn on top of the fill and remain visible.

## Vertex editing (already wired, verified)

In Setup with the "Excluded areas" tool selected, saved exclusion vertices behave exactly like boundary vertices:
- Each corner shows a gray dot handle.
- Press and drag a handle to move that vertex; it turns amber while active.
- Release commits the new position through `onChange`.

No new drag logic needed — the existing `onImagePointerDown/Move/Up` handlers in `SetupTab.tsx` (lines 522–592) already cover exclusions. The hatched fill sits under the handles so grabbing them is unaffected.

Topo tab and Data tab are unchanged.
