I’ll make two focused fixes:

1. **Transparent crosshatch on Boundary setup only**
   - Change the exclusion drawing helper so `hatched` mode does **not** paint a white/opaque fill.
   - Draw light diagonal lines clipped inside the exclusion polygon, with the plan still visible underneath.
   - Use a true diagonal crosshatch look, not a filled/checkered pattern.
   - Keep Topo behavior unchanged: excluded areas remain masked out on the topo side.
   - Keep Data behavior unchanged: no exclusion overlay on the data side.

2. **Lock the setup chrome/pills in place**
   - Restructure the Boundary setup screen so the top tool row, exclusion chips/list, and bottom Back/Start Surveying row stay fixed.
   - Only the `PlanCanvas` area will be the moving/panning/zooming surface.
   - Prevent the setup panel itself from scrolling while dragging/pinching the plan, so the chrome doesn’t slide around with the canvas.

I’ll keep this limited to the Boundary setup screen and the exclusion drawing helper.