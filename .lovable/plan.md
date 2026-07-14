Plan to fix the trash can mismatch:

1. Match the reference button, not approximate it
   - Bottom-right fixed circle.
   - Larger soft cream/off-white circular surface.
   - Very light grey trash icon.
   - Subtle border and shadow.
   - No dark outline, no strong contrast, no badge unless we intentionally need it later.

2. Match the reference placement
   - Keep it low in the bottom-right corner above the phone home indicator/safe area.
   - Use the same visual spacing as the Distress Survey screenshot: close to the right edge and bottom, not floating too high.

3. Keep behavior already agreed
   - Trash can is always visible.
   - Empty trash: faded/quiet and tapping says “Trash is empty.”
   - Non-empty trash: opens the trash dialog.

4. Limit the change
   - Update only the home-screen trash button styling in `ProjectList.tsx`.
   - Do not change project delete/restore/permanent-delete behavior.

Technical detail:
- Replace the current button classes with reference-matching dimensions, background, shadow, border, icon size/color, and safe-area positioning.
- Remove the red count badge if matching the Distress Survey screen is the priority, because the reference trash button does not show one.