Fix the oversized stepper controls in the Topo tab's Labels & layers popover so they match the compact, professional size used in the Data Points panel.

Changes

1. `src/components/tabs/TopoTab.tsx`
   - Update the local `StepperControl` component:
     - Shrink the `−` and `+` buttons from `h-9 w-9` to `h-6 w-6`.
     - Shrink the icons from `h-3.5 w-3.5` to `h-3 w-3`.
     - Shrink the input from `h-9` to `h-6` and use `text-[10px]` font to match the Data Points panel readout.
     - Keep the input editable (draft string + blur commit) so the previous typing fix remains.
     - Add a `px` suffix in the display, matching the Data Points panel convention.

2. Verification
   - Open Topo → Labels & layers → Label style.
   - Confirm the Point label size and High / low size steppers are visually the same scale as the dot size / label text controls in the collapsed Data Points panel.
   - Confirm tapping +/− still changes values by 1px and clamps at 7–28.
   - Confirm typing a value directly still works.