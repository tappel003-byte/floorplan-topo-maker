**Plan**

- Restore the circled stepper value so it visually reads compact again, like it did before the last change.
- Keep the actual input safe from the phone zoom issue by changing the control behavior/styling around the input, not by making the displayed text large.
- Apply this only to the Topo label-size steppers that were affected.
- Verify on the phone-sized preview that:
  - the value no longer looks oversized,
  - tapping the control does not blow up the screen or lose the app chrome,
  - the plus/minus controls still work.

**Technical approach**

- Update the Topo stepper input styling so the browser can avoid focus zoom while the visible text remains small.
- If needed, make that tiny value field non-keyboard-editable and leave sizing changes to the minus/plus buttons, because the user explicitly asked for arrows in these boxes.