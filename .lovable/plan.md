## Problem

Tapping into a text field inside the Topo tab's popovers (Count, Step, hex color, and the new stepper inputs) makes iOS auto-zoom the page and knocks the app chrome out of place. Same class of bug we already fixed on the Boundary/Setup screen — the fix was never applied to Topo.

## Root causes (same two as before)

1. Inputs use font sizes below 16px (`text-xs`, `text-[10px]`, hex color input). iOS Safari force-zooms any input under 16px on focus.
2. Topo's `PlanCanvas` re-fits on every viewport resize, so when the iOS keyboard opens the canvas re-fits and the surrounding chrome reflows.

## Fix (mirrors what SetupTab already does)

**`src/components/tabs/TopoTab.tsx`**
- Add `refitOnResize={false}` to the `<PlanCanvas>` used by Topo (Setup already does this).
- Bump every popover input to the `text-base sm:text-xs` pattern so mobile gets 16px (no iOS zoom) while desktop keeps the compact look:
  - Count input (line ~612)
  - `StepInput` (line ~907)
  - `NumberControl` / `StepperControl` text input (line ~1026)
  - The color hex `<Input>` in the Labels & layers popover
- Add `enterKeyHint="done"` to those inputs so the keyboard shows a Done affordance, matching Setup.

No behavior changes, no logic changes — visual size stays the same on desktop; on phones the inputs render slightly taller (16px text) inside the popover, which is exactly what Setup already does.

## Verify

Load the Topo tab on the phone viewport, open the Labels & layers popover, tap into the hex color and the stepper inputs — page should not zoom and the top bar / pills should stay put.
