I found the break window: after the third-transition dropdown fix, the next change altered the active-correction overlay and point tap behavior. That is where this started.

Plan:
1. Restore the pre-break tap behavior in `FieldTab.tsx` from before that overlay/tap-path change:
   - tapping a normal point opens the keypad
   - tapping a corrected point opens the keypad
   - tapping a baseline/root chain point opens the keypad
   - tapping a diamond anchor re-arms/highlights the correction chain, without blocking other point taps
2. Remove the later conflicting tap-path helper/changes that tried to force every chain tap through a new path.
3. Restore the active-correction popover event behavior to the version before the regression, while keeping its existing position.
4. Keep the changes that were not part of the break:
   - unlimited flooring correction depth
   - unlocked From/To transition dropdown behavior
   - manual correction override fields
   - baseline readings joining the halo when entered through the active correction flow
   - current chip/pill positions
5. Verify by checking the exact tap path in code: a highlighted/corrected point must end by opening the keypad, not just highlighting the chain.

If this does not restore it, I will tell you to revert to the version immediately before the safe-overlay/tap-path change rather than spending more time patching around it.