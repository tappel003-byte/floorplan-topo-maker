# Fix: points move too easily during pinch-zoom

## Problem
In `src/components/tabs/FieldTab.tsx`, tapping a data point immediately arms a drag. Any finger movement over ~18px moves the point. During a pinch, the first finger can travel that far before the second finger registers, so the point slides.

Note pins and anchor-detail already gate on a long-press (`LONG_PRESS_MS = 380`). Regular points do not.

## Change (one file)
`src/components/tabs/FieldTab.tsx` — apply the same long-press arming used for notes to ordinary point drags:

1. Add an `active: boolean` flag to `DragState` (default `false`).
2. In `onImagePointerDown`, after setting `dragRef.current`, start a `LONG_PRESS_MS` timer that flips `dragRef.current.active = true`. Keep the anchor-detail long-press timer as-is (they run in parallel — whichever fires first wins for anchors; for anchors we still open the dialog since `moved` stays false).
3. In `onImagePointerMove`, before applying position updates:
   - If screen distance > ~8px before `active`, treat it as a scroll/pinch attempt → clear both timers, clear `dragRef.current`, and return (do NOT move the point).
   - Only mutate point coordinates when `active` is true.
4. In `onImagePointerUp` / `Cancel`, clear the new timer alongside the existing ones. Tap-to-select behavior (no move, no long-press) stays intact — pointer-up with `!moved && !active` still runs the current selection/keypad path.
5. PlanCanvas pinch-preempt logic already cancels custom drags when a second pointer arrives (`onImagePointerCancel`), so no changes there.

## Result
- Short tap → select / open keypad (unchanged).
- Long-press then drag → move the point (new gate).
- Pinch-zoom starting on or near a point → no accidental move.

No other files, no data model changes.
