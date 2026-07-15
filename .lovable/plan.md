I understand the two problems:

1. Tapping/typing in the excluded-area name boxes opens the keyboard and the app viewport resizes, which makes the setup chrome and canvas jump/zoom.
2. The exclusion hatch is producing stray diagonal lines that appear outside the intended excluded boxes.

Plan:

- Keep the setup chrome fixed while editing labels:
  - Make the Boundary setup area use a fixed-height shell so the top bar, step tabs, tool pills, exclusion chips, and bottom action bar do not reflow when the phone keyboard opens.
  - Let only the canvas viewport be the moving/panning area.

- Stop input taps from affecting the canvas:
  - On the exclusion label inputs, prevent pointer/touch events from bubbling into the canvas/gesture layer.
  - Keep typing/editing labels working normally.

- Fix the rogue diagonal hatch lines:
  - Rewrite the hatch drawing so each line is clipped to the exclusion polygon with a safe canvas save/restore path.
  - Draw only one clean diagonal crosshatch direction, transparent over the plan, with no fill and no second-direction “checker” effect.
  - Keep this hatch only on the Boundary setup tab; Data stays unchanged and Topo keeps its exclusion behavior.

- Verify on a phone-sized viewport:
  - Open Boundary setup, focus a label input, confirm chrome stays locked.
  - Confirm hatch lines stay inside each excluded polygon and no rogue diagonals cross the plan.