## Reuse the keypad's surface-choice row when editing a chain point

**The problem**
Tap the circled `9.20+0.2` point to edit and the keypad shows only `9.2` with the "resolve back to Tile" caption. You can't see the `+0.2`, can't see which link in the chain it's tagged to, and can't switch it to a different surface in the same chain if you tagged it wrong.

**What changes**
When the keypad opens to edit a point that already has a `transitionId`:

- Show the same **surface-choice row** the keypad already renders during fresh transition entry — but populated with **every link in this point's chain** (root → leaf), plus a "None" option to clear the tag.
- The point's current link is preselected/highlighted.
- Tapping a different surface reassigns the point to that link. The raw value the user is typing stays; the live "= X.XX corrected" preview under the number field updates immediately (same preview that already exists).
- No new component, no chip strip — same row, same styling, same interaction pattern as during transition entry.

That's the whole change. Anchors, new-point entry, math, canvas, chain popover: unchanged.

**Scope**
- `src/components/NumericKeypad.tsx` — extend the existing surface-choice row's render condition: also show it when editing a point with a `transitionId`. Source the surface list from the chain (walk `parentId` up from the point's transition). Wire the tap to a new `onReassignTransition(transitionId | null)` prop.
- `src/components/tabs/FieldTab.tsx` — at the edit-point keypad call site, pass in the floor's transitions and a reassign handler that updates the point via the existing `onPointsChange` + history-commit path.

Reuses `getChainBaselineSurface`, `transitionDelta`, `formatDelta` from `src/lib/transitions.ts`.
