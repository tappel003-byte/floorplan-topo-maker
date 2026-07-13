## Make every point in a flooring chain editable

Right now, tapping a diamond anchor opens the transition detail dialog and you can edit it. Tapping a downstream point (a regular reading tagged to a transition, e.g. one taken "on carpet" after a Tile→Carpet doorway) opens `PointDetail`, but that dialog has no idea the point is part of a chain — it just shows the raw number with no surface context and no way to change which chain the point belongs to. Come back to it later and you can't tell what you originally entered or which correction is being applied.

### What changes

Extend `PointDetail` so a chain-tagged point shows its full context and is fully re-editable — matching the round-trip the anchor already gets.

When the opened point has a `transitionId` (and is not itself an anchor):

1. **Show the chain context at the top of the dialog**
   - Baseline surface (chain root's `surfaceA`, via `getChainBaselineSurface`)
   - This point's surface (the transition's `surfaceB`)
   - The active correction applied (`+0.4"` etc.) and the resulting corrected value
   - Same "All corrections resolve back to {baseline}" caption used in the keypad and popover, so the wording is consistent everywhere

2. **Edit the raw reading in place**
   - The Elevation field stays the raw value you originally typed (that's already what's stored). Label it clearly as "Raw reading on {surfaceB}" and show a live "= X.XX corrected" preview underneath so you can see the effect of your edit without doing the math.

3. **Change which chain/link this point belongs to**
   - Add a "Correction" row with the current transition shown as a chip (e.g. "Carpet correction +0.4"") and a "Change" button.
   - "Change" opens the existing `TransitionPickerSheet` scoped to the current floor's transitions, so the user can reassign the point to a different link in the same chain, a different chain entirely, or clear the tag (making it a plain reading again).
   - Reassigning only rewrites the point's `transitionId` — the raw `value` is preserved, so the corrected value updates automatically via the existing `correctedValue` pipeline.

4. **No changes to** anchor behavior, transition math, the keypad, the canvas, or how downstream points are created. This is a read/edit surface only.

### Technical notes

- File: `src/components/PointDetail.tsx` — accept `floor: Floor` (or `transitions` + `onReassignTransition`) as a prop, look up `point.transitionId` in `floor.transitions`, and render the chain context block above the existing Elevation field when found.
- Reuse: `getChainBaselineSurface`, `transitionDelta`, `formatDelta`, `correctionLabel` from `src/lib/transitions.ts`; `TransitionPickerSheet` for the reassignment picker.
- Call site: `FieldTab.tsx` — pass the current floor into `PointDetail` and wire an `onReassignTransition(pointId, transitionId | null)` handler that updates the point via the existing `onPointsChange` + history-commit path.
- Anchor points (`isTransitionAnchor === true`) continue to route to `TransitionDetailDialog` as they do today — `PointDetail` is only for non-anchor points.
