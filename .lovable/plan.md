You’re right. You already gave the spec. I will stop asking you to restate it and build against the June 25 scope we agreed to.

## What I will build

### 1. Field capture workflow
- Floor plan upload as the base map.
- Real pan/zoom for accurate point placement on tablet/desktop.
- Boundary polygon step that clips all topo output to the house footprint.
- Tap/click to place elevation points directly on the plan.
- Large numeric keypad for elevation entry, not dropdown-style data entry.
- Point edit, move, delete, and clear value labels.
- Auto-save so points are not lost.

### 2. Render modes we agreed to
- Color fill contours.
- Color cells.
- Simple black/white contours.
- Points-only output.

### 3. Topo output closer to the screenshots
- Minimum-curvature-style gridded surface instead of the rough demo look.
- Boundary-clipped filled contours.
- Brown/elevation-style ramp option as the professional default, with other palettes available.
- Contour line labels.
- Major/minor contour weights.
- High/low callouts.
- Movable legend/color scale that exports exactly where you place it.
- Floor plan remains readable under the topo through opacity/layer controls.

### 4. Contour controls from the 3-D Field workflow
- First contour value.
- Step size.
- Count.
- Min/max clamp.
- Decimal display control.
- Label on/off.
- Point labels on/off.
- Line thickness.
- Palette reverse.

### 5. Exports
- Export the full composed sheet as PNG/JPEG.
- Export PDF suitable for report use.
- Export points-only plan.
- Keep legend, labels, H/L markers, and plan position baked into the export.

### 6. Reliability / field use
- Auto-save after edits.
- Project list with saved jobs.
- Visible point count.
- Undo/redo if supported cleanly by the existing code structure.
- No forced “save after every point” workflow.

## Build order

1. Audit the current app against this list.
2. Fix the core topo renderer first: grid generation, clipping, color fill, cells, labels, legend, H/L.
3. Replace the simplified contour settings with the agreed first/step/count + min/max/decimals controls.
4. Improve the field entry flow and point editing where it falls short.
5. Add/export the professional outputs.
6. Verify on the live preview with a floor plan/boundary/points scenario before I tell you it is done.

## What I will not do in this pass
- I will not add geology features you said you do not need.
- I will not ask you to redesign the app again.
- I will not build 3D terrain yet unless you explicitly bring v2 forward.

If you approve this, I’ll start by auditing the current files and then build this spec directly.