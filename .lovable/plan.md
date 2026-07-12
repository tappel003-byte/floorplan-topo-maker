## Goal

Two related keypad/anchor fixes so transitions become room-scoped and re-selectable:

1. Explicit **"Done with this transition"** button on the keypad ends the active chain.
2. Tapping **any diamond** on the plan re-arms that diamond's **entire chain** (root + all descendants), reopening the keypad with the full surface-choice row.

## Behavior

**Ending a chain**
- When `activeTransitionId` is set, the keypad shows a small `Done with this transition` button in the header (next to Undo / Delete / Close).
- Tapping it clears `activeTransitionId` and closes the keypad. Next tap on the canvas is a plain point again.
- The existing "Correct for flooring" button stays visible always (already covered by prior scoping work) so a new, unrelated transition can be started at any time.

**Re-arming a chain**
- Tapping a diamond anchor on the plan:
  - Sets `activeTransitionId` to the **root** of that anchor's chain (walk `parentId` up to the top).
  - Opens the keypad in "next point" mode (empty value, ready to type), same state you'd be in right after finishing a transition.
  - The bottom surface-choice row shows every surface in the chain (root + descendants), computed the same way as during original creation.
- Tapping a non-anchor point keeps existing behavior (edit that point).

## Files

- `src/components/tabs/FieldTab.tsx`
  - Add `handleAnchorTap(transitionId)`: walk to root, set `activeTransitionId`, open keypad in new-point mode positioned at the anchor's coords (or just re-arm without a pending coord — TBD by existing flow; match whatever "start next point" currently does).
  - Wire it to the diamond marker's tap handler (currently opens the transition detail dialog — we'll keep that on long-press / detail button, and make a plain tap re-arm).
  - Pass a new `onEndTransition` callback to `NumericKeypad`.
- `src/components/NumericKeypad.tsx`
  - Add `onEndTransition?: () => void` prop.
  - When `activeTransition` is set, render a compact "Done with this transition" button in the header row (left side, near Undo). No other layout changes.

## Out of scope

- Diamond color, downstream highlight behavior, delete/detach, chain math — all untouched.
- No changes to `transitions.ts` or storage shape.
- The transition detail dialog (minimize/expand, ✕ detach) stays exactly as-is; only the plain-tap gesture on the diamond changes.

## Open question before build

Right now a plain tap on a diamond opens the **transition detail dialog**. If I move plain-tap to "re-arm the chain," how do you want to reach the detail dialog? Options that come to mind: a small info button on the dialog-less anchor, or long-press. I'd rather you tell me which feels right than guess.
