## Fix Manual adjust behavior

**What's wrong now:** Manual adjust ±0.1 edits the raw reading of the "to surface" (which recomputes the delta indirectly and also shifts every downstream point's raw value). That's not what you want.

**What you want:** Manual adjust nudges the **correction delta itself** — a manual override on the transition. Raw readings stay untouched. Downstream points still resolve through the (now-overridden) delta, but the readings you originally logged aren't rewritten.

### Changes to `src/components/TransitionDetailDialog.tsx`

1. **Restore the ±0.05 buttons.** Row becomes: `−0.1  −0.05  +0.05  +0.1`.
2. **Rewire the handlers.** Instead of mutating `rawB` (the "to surface" reading), write to a `manualDeltaOverride` field on the transition (new optional field, falls back to computed `rawB − rawA` when absent).
3. **Color the override red.** When `manualDeltaOverride` is set, render the "Carpet correction +0.4"" row value in red (`text-destructive`) so it's obvious the delta is a manual override, not derived from the two readings.
4. **Clear-override affordance.** If a user then edits either reading field, drop the override and revert to computed delta (returns to normal color).

### Downstream

- `getCorrectedValue` / chain math reads `manualDeltaOverride ?? (rawB − rawA)` — one-line change in `src/lib/transitions.ts`.
- No changes to point records. No raw readings on downstream points get rewritten.

### Not touching

- Point editing flows, keypad, chain highlighting, pill, centering — all stay as-is.
