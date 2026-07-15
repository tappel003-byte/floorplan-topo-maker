Fix Topo exclusions so they behave as an invisible cutout through the topo layer only.

What will change:
- Remove the Topo-side white fill behavior entirely.
- Remove the Topo-side outline/border around the excluded area entirely.
- Keep the underlying plan visible inside the excluded area — walls, doors, labels, and plan lines should still show.
- Keep the exclusion affecting the topo calculation/rendering only, so topo colors/contours/cells do not appear inside the excluded polygon.

Technical approach:
- Update the topo rendering/compositing path so exclusion polygons punch out the topo overlay itself, instead of drawing a white polygon on the main canvas.
- Stop using `drawExclusionShape` as a Topo mask pass.
- Leave Boundary setup hatching alone: setup still shows the transparent hatch so you can see what you are excluding.
