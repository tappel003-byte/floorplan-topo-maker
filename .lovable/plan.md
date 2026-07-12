I understand. I will treat this as a restoration, not a redesign.

Plan:
1. Restore the field interaction rule: tapping any visible reading opens the edit keypad, including:
   - normal points
   - corrected flooring points
   - chain baseline points with no correction value
   - diamond anchor points
2. Keep the chip/pill layout where it is now; no layout changes.
3. Remove any remaining tap-blocking behavior from the active correction popover so it cannot create a dead area over the canvas.
4. Keep long-press / active-correction details available, but never let those prevent a normal tap on a point from editing that point.
5. Verify the code path so a highlighted chain point still goes through the same edit path as every other point, instead of only highlighting or re-arming the chain.

Technical detail:
- The fix will stay in `FieldTab.tsx` unless verification shows `PlanCanvas.tsx` is still swallowing the tap.
- I will not move the toolbar, notes pill, active correction pill, stats chip, or canvas layout.