## Goal

Make the flooring-correction keypad match what we agreed to in words: **no chip/pill row above the number pad**, and when a chain is active the **bottom row is the only place surface choices appear** (no leftover full-width Enter).

## What's wrong right now (from image-170)

Looking at `src/components/NumericKeypad.tsx`:

1. The active-transition **corrected-value preview** (`= 9.00" (8.60 + 0.4 → Carpet)`) still renders above the number pad whenever `activeTransition` is set. That's the strip you circled at the top.
2. The `showShortcutRow` block (Repeat / Correct-for-flooring buttons) is hidden when a transition is active — good — but the corrected-value preview above it is not, so the "top row" visually persists.
3. In the bottom action area, the fallback branch still renders a full-width **Enter** button when `activeTransition` is set but `surfaceOptions` isn't passed (e.g. editing an existing point, or a chain with only one surface). That's why some screens still show Enter at the bottom instead of surface buttons.

## Fix (single file: `src/components/NumericKeypad.tsx`)

1. **Remove the top corrected-value preview block entirely.** Delete the `activeTransition && (() => { ... })()` IIFE that renders the `= X.XX"` line above the keys. Correction context belongs on the bottom buttons (each surface button already shows its delta), not as a header strip.
2. **Keep** the number-grid change already in place: when `usesBottomCorrectionActions` is true, skip rendering the in-grid backspace + full-width Enter.
3. **Bottom row behavior** when `usesBottomCorrectionActions` is true:
   - If `hasSurfaceRow` → render backspace + one button per surface (already correct).
   - Else (active transition but no surface options passed) → render backspace + a single flex-1 **Enter** button that submits the raw value. This is the existing fallback; leave it.
4. No changes to `FieldTab.tsx`, `transitions.ts`, or storage. This is purely the keypad's own layout.

## Out of scope

- Chain computation, anchor coloring, downstream highlights, delete/detach behavior — untouched.
- No new props, no API changes to callers.

## Verification

After the edit I'll re-read `NumericKeypad.tsx` to confirm the top IIFE is gone and the bottom branch is the only place correction UI renders. I can't screenshot the live preview reliably, so if it still looks wrong on your device please send a screenshot and I'll iterate.
