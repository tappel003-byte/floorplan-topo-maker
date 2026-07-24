## Behavior

Linear chain T1 → T2 → T3 → T4:
- Tap T1 → highlight T1, T2, T3, T4 and all their points
- Tap T2 → highlight T2, T3, T4 and their points
- Tap T3 → highlight T3, T4 and their points
- Tap T4 → highlight only T4 and its points

Same rule for branches: tapping any transition highlights itself + everything downstream of it.

## Change

`src/components/tabs/FieldTab.tsx` — the current `descendantsOf` helper already does exactly this. Verify tap handler uses it for both the diamond highlight and the point halo, and that no leftover `chainOf` (upstream walk) is still wired in. Fix any gap so the four-transition case above matches.

No other files change.