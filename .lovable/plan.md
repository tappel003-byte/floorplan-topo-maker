## Fix "Other" surface overflow in Add Transition

**Scope:** `src/components/AddTransitionSheet.tsx` only. No logic changes.

1. Cap the custom "Other" text input at 20 characters (`maxLength={20}`).
2. Set its placeholder to `e.g. Sunken living room (20 char max)` so the limit is visible before typing.
3. Shorten the correction row label to `Correction` so a filled-in custom name has room to sit on one line.

Nothing else touched — wood/vinyl list and boundary filter port to V2 come after you confirm this looks right.