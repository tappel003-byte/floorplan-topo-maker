## Plan

Fix the active correction behavior without changing the design again.

1. **Restore the working interaction model**
   - Tapping a transition point or diamond should set the active/viewed correction chain for highlight.
   - It should still allow the tapped point/diamond to be selected and edited.
   - The active correction pill should also highlight the same chain when selected/opened.

2. **Stop the popover from blocking point selection**
   - Keep the pill usable.
   - Make the expanded correction panel only intercept taps on its own controls, not prevent selecting points underneath once the user is trying to work on the canvas.

3. **Fix chain highlighting coverage**
   - Include every point tied to any correction in the chain.
   - Include diamond anchors.
   - Include baseline/root points like the uncorrected `9.0` that are part of the chain even when they have no delta applied.

4. **Do not move the UI again**
   - Keep the Notes pill, Active correction pill, Stats chip, and data panel positions as they were before the positioning regression.
   - Do not touch the Add Transition surface unlock or manual override math unless directly needed for this selection bug.

## Technical notes

- Work mainly in `FieldTab.tsx` around point tap handling, `activeTransitionId` / `viewingTransitionId`, `chainPopoverOpen`, and `drawOverlay` highlighting.
- Use the existing chain helpers (`chainOf`, `rootTransitionId`, `transitionDelta`) rather than adding a new workflow.
- Keep overlay `stopPropagation` only where it protects buttons/inputs; avoid making the popover a giant dead zone over the canvas.