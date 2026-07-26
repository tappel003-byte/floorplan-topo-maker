## Fix

The legend's position is clamped with `Math.max(0, ...)` in image coordinates (TopoTab.tsx lines 510–511). Image coord `0` is the left edge of the floor plan raster, not the canvas edge. On desktop the plan is centered with whitespace to its left, so the legend can never cross into that left whitespace — exactly the wall you're hitting.

Change: remove the `Math.max(0, ...)` clamp so `legendX` / `legendY` can go negative, letting the legend move freely into the whitespace on any side.

No other behavior changes.