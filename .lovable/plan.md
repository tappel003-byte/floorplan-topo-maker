Add a dedicated High/Low pin size control in the Topo tab so the red "High" and blue "Low" badges can be resized independently from the point elevation labels.

Changes

1. `src/lib/types.ts`
   - Add `highLowPinSize: number` to `RenderSettings`.
   - Set default `highLowPinSize: 11` in `defaultRenderSettings` so current rendering stays unchanged by default.

2. `src/components/tabs/TopoTab.tsx`
   - Replace the hard-coded pin constants with functions driven by `resolved.highLowPinSize`:
     - Pin height scales with the font size (e.g. `fontPx * 1.82`).
     - Pin font uses `resolved.highLowPinSize` px.
     - Pin vertical offset keeps the badge centered above the point.
     - Minimum pin width stays at least `text width + padding`, scaled.
   - Update `drawPin()` to accept a `fontPx` argument and compute `pinH`, `topOffset`, and width from it.
   - Update the long-press hit-test in `renderTopoTop` so the touch target matches the scaled badge.
   - Add a "High/Low size" `NumberControl` slider in the Labels & layers popover, range 7–28 px, step 1, placed near the existing "High / low" switch or the label-style section.

3. Verification
   - Open Topo → Labels & layers.
   - Toggle High/Low on and adjust the new size slider.
   - Confirm the High and Low badges resize, stay legible, and remain draggable/long-pressable.