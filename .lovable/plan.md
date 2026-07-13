## Diagnostic panel on Topo tab

Reuse the Data tab's points panel on the Topo tab as a scratchpad for excluding points from the contour math. Raw data is never modified.

### Entry point

- A new toolbar button (small table/list icon) appears **only on the Topo tab**, next to Undo/Redo.
- Tap to open the panel, tap again to close. Button shows a small badge with the count when any points are excluded.

### Behavior

- Panel is the same floating, movable component as `DataPointsPanel` on the Data tab (sortable columns, same rows).
- Each row has a delete/exclude action. Tapping it removes that point from the contour computation immediately.
- Grid, contours, gradient dots, and High/Low pins all recompute live from the remaining points.
- Excluded rows stay in the panel, dimmed/struck-through, with an Undo affordance to restore that one point.
- A "Restore all" button at the top of the panel clears the exclusion set.
- Session-only and Topo-only: exclusions clear when leaving the Topo tab or switching floors. Field, Data, Review, Export, and stored data are untouched.
- Everything else on Topo (gradient dots, contour styling, pins, legend) stays exactly as it is.

### Technical notes

- Add `excludedPointIds: Set<string>` as local `useState` in `TopoTab.tsx`; not persisted.
- Add the toolbar icon button in the Topo tab's toolbar area only, wired to a local `panelOpen` state.
- Reuse `DataPointsPanel` (or a thin wrapper). Pass:
  - `points` (full list, for display + sort)
  - `excludedPointIds` + `onToggleExclude(id)` + `onRestoreAll()`
  - Suppress edit/color/marker controls in this context — read-only except for exclude/restore.
- Derive `visiblePoints = points.filter(p => !excludedPointIds.has(p.id))` and pass that wherever the topo currently consumes `points` for grid/contour/High-Low math and dot rendering.
- Clear the set in a `useEffect` cleanup on tab unmount and on `floor.id` change.
- No changes to types, storage, other tabs, or transitions.
