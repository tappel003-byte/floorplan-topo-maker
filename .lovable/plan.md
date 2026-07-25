## Plan

Fix the Add Transition sheet so every open starts clean.

1. In `AddTransitionSheet.tsx`, update the existing `useEffect` that runs when the sheet opens.
2. Always reset the custom “Other” fields on open:
   - clear `otherA` and `otherB`
   - set `isOtherA` and `isOtherB` back to `false`
3. For non-chained transitions, also reset the surface dropdowns to their defaults:
   - From: `Tile`
   - To: `Carpet/slab`
4. Keep the chained transition behavior intact: the From side still defaults to the selected chain parent surface.

No transition math or save logic changes.