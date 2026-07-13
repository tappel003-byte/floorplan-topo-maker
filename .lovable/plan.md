## Fix correction display precision + auto-clear override

**Two small changes to `TransitionDetailDialog.tsx` and `transitions.ts`.**

### 1. Show 2 decimals on the correction value

Right now `formatDelta()` returns `+0.4` — the hundredths digit is invisible, so a nudge from `+0.40` to `+0.45` looks identical to `+0.4`.

- Change `formatDelta()` in `src/lib/transitions.ts` to `toFixed(2)` so it renders `+0.40`, `+0.45`, `-0.35`, etc.
- This flows through the dialog's correction row, the minimized pill, and the `transitionLabel()` chip automatically.

### 2. Return to black when the override matches the computed delta

If the user nudges the override back to the same value as `readingA − readingB`, the row should go back to black (no override).

- In `TransitionDetailDialog.tsx`, after `nudgeDelta()` computes `next`, if `Math.abs(next − computedDelta) < 0.005`, call `setOverrideDelta(null)` instead of setting the value. The row's `isOverridden` flag then flips back to false and the text renders in the default color.

### Not touching

- Manual adjust step sizes (still ±0.05 / ±0.1).
- Reading fields, downstream point math, dialog layout, pill wording.
