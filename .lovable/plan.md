## Problem

When a transition is active, the keypad hides the "Correct for flooring / Add another" shortcut row, so there's no way to chain a second transition (e.g., Carpet → Wood → Tile) from the keypad. The screenshot shows Tile/Carpet surface buttons at the bottom but no "Add another" button anywhere.

Cause: in `NumericKeypad.tsx`, `showShortcutRow = !activeTransition && (hasRepeat || !!onAddTransition)` — the `!activeTransition` gate suppresses the whole row while a chain is live.

## Change

In `src/components/NumericKeypad.tsx`, allow the "Add another" button to show while a transition is active:

- Drop `!activeTransition` from `showShortcutRow`.
- Keep "Repeat" hidden while a transition is active (repeating a raw reading mid-chain is ambiguous — safer to require an explicit tap on a surface button). So the row, when a transition is active, shows only the "Add another" pill.
- Label already switches to "Add another" via existing `activeTransition ? "Add another" : "Correct for flooring"`.

No other behavior changes. Tapping "Add another" opens `AddTransitionSheet` in chained mode (already wired via `parentDelta` / `parentSurface` in `FieldTab`).

## Out of scope

- Diamond tap / re-arm behavior, "Done with this transition" button, surface-choice row, chain math, storage — untouched.
