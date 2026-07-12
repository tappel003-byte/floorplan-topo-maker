## Plan

Fix the regression by restoring the point tap/edit path and making the hit target match what is actually drawn.

### What I will change

1. **Make every highlighted chain point selectable/editable again**
   - A normal tap on any point in the correction chain opens the keypad for that point.
   - This includes corrected points, baseline/root points like the uncorrected `9.00`, and diamond anchor points.
   - Tapping a chain point may still activate/highlight the correction chain, but it must not block editing that point.

2. **Remove the bad early return for diamond anchors**
   - Right now anchor taps can set the active correction and then stop before opening the point editor.
   - I will change that so the chain is activated, then the tapped point still becomes the editable point.
   - Long-press can still open correction details if that behavior is needed, but plain tap edits the point.

3. **Fix label hit-testing for corrected labels**
   - The visible label can be `9.20-0.2` or `8.00+0.5`, but the tap target is still calculated as if it were only `9.20` / `8.00`.
   - That makes the visible label partly untappable, especially when zoomed.
   - I will make hit-testing use the same displayed label text that the canvas draws.

4. **Do not move the toolbar/chips/design**
   - No placement changes to Notes, Active correction, Stats, Data/Topo, or the correction popover.
   - No new workflow.
   - No redesign.

5. **Verify the exact behavior**
   - Confirm tapping a corrected label opens the keypad.
   - Confirm tapping the dot opens the keypad.
   - Confirm dragging still moves the point.
   - Confirm chain highlighting remains visible while selection/editing works.

### Technical details

- Main file: `src/components/tabs/FieldTab.tsx`.
- Update the `onImagePointerUp` branch so `setEditingPoint(point)` always runs for plain taps on existing points, including transition anchors.
- Add/reuse a small helper for displayed point labels so `hitPoint()` and `drawOverlay()` calculate the same label string.
- Keep existing chain helper behavior and manual override math unchanged.