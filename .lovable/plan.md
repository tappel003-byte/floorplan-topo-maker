Add +/− stepper buttons to the two label-size inputs in the Topo tab so they match the existing pattern in the Data Points panel.

Changes

1. `src/components/tabs/TopoTab.tsx`
   - Replace the bare `NumberControl` inputs for **Point label size** and **High / low size** with a stepper control that shows a `-` button, the number, and a `+` button in a single row.
   - The stepper should live inside the existing `NumberControl` component so the decimals control above can keep using the same component, or create a local `StepperControl` variant.
   - Each tap of `-` or `+` changes the value by 1 px (respecting the 7–28 min/max range).
   - Keep the number editable as a plain input so the user can still type a value directly (as already fixed for multi-digit typing).
   - Use the same styling as the Data Points panel: compact buttons, 10px monospace centered value, minimal borders.

2. `src/components/DataPointsPanel.tsx` (reference only — no changes required)
   - The existing point-size and label-font-size steppers in the collapsed panel are the pattern to match.

3. Verification
   - Open Topo → Labels & layers → Label style.
   - Tap `-` and `+` on both Point label size and High / low size; confirm the value changes by 1 px and clamps at the min/max.
   - Confirm the canvas labels/pins update immediately.
   - Confirm typing a value directly still works.