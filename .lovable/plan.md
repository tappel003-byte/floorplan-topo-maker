## Match topo point markers to data screen

**Problem:** On the data (field) screen, points are drawn as solid colored dots (red by default) using the project's `pointColor`. On the topo screen, the same points render as a dark/green fill with a white outline — an inverted, unrelated style.

**Change:** One block in `src/components/tabs/TopoTab.tsx`, inside `renderTopoTop` (~lines 1236–1247, the `if (resolved.showPoints)` dot loop).

- Replace the current fill (`p.isBasePoint ? "#16834a" : "#17130e"`) with the same color the field tab uses: the project `pointColor` (red default), with the existing base-point green kept for base points only.
- Remove the white stroke on the dot so it renders as a solid colored dot, matching the data screen.
- Keep everything else (size via `pointSize`, selection halo, labels, base-point green) untouched.

**Wiring:** `pointColor` isn't passed into the topo overlay today. Add it to the overlay options object next to `pointSize` (in the `drawOverlayTop` call at ~line 554 and the overlay type at ~line 1215), sourced from the same project setting the field tab reads.

**Not touching:**
- Field tab rendering
- Point size, label style, palettes, selection ring color
- Base-point color (stays green so base points remain distinguishable on topo)

Result: a red point on the data screen is a red point on topo, same size, same color.