## Two small Topo tweaks

### 1. Stats chip reflects exclusions (Topo only)
In `src/components/tabs/TopoTab.tsx`, pass `visiblePoints` (already derived for the contour math) to `StatsChip` instead of the full `points` array. High / Low / Δ will recompute live as points are excluded and restored. Field, Data, and Review keep passing the full set — nothing changes there.

### 2. Diagnostic toggle stays put
Leave the toggle button where it already is (floating bottom-right, next to the palette chip). Always visible on the Topo tab regardless of exclusion count, so there's never a "where did it go?" moment. The count badge continues to appear only when points are excluded.

No other files touched. No data model changes. Session-only exclusions still clear on floor change / tab unmount.