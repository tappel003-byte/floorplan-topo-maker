## What's actually happening

Two separate bugs, both visible in that screenshot:

### 1. The ~1" wrong reading (real data issue)

`transitionDelta()` in `src/lib/transitions.ts` gives **group averages priority over the doorway's own measurement**:

```
1. manualDeltaOverride  (per-doorway)
2. groupAverages[pair]  (one number for ALL doorways of that surface pair)  ← the culprit
3. readingA − readingB  (this doorway's actual measurement)
```

If a floor has three Carpet→Tile doorways that each measured a slightly different delta, and an "applied average" exists for that pair, every downstream point uses the average instead of its own doorway's delta. On a house with three real transitions that can easily land ~1" off from what you'd expect.

Your raw readings never changed — only the applied delta did. That matches what you saw: raw values are intact; only the *corrected* value on topo/data was wrong.

**Fix:** flip the precedence so the doorway's own measured delta wins by default. Group averages become opt-in per doorway (a "use group average" toggle on the transition), not an automatic override.

```
1. manualDeltaOverride
2. readingA − readingB           ← default
3. groupAverages[pair]           ← only if the doorway opts in
```

### 2. The `9.3000000000000002` on the keypad (display bug)

Floating-point artifact from `raw + delta`. Fix by rounding to 2 decimals at the render sites only (keypad preview, plan labels, topo labels, review table). Stored raw values stay untouched.

## Scope

- `src/lib/transitions.ts` — reorder precedence in `transitionDelta`; add a `useGroupAverage?: boolean` flag on Transition; round `correctedValue` result to 2 decimals.
- `src/lib/types.ts` — add the optional flag.
- `src/components/TransitionsSheet.tsx` — the "apply average" control now sets the flag on each doorway in that group instead of writing a global map; existing `transitionGroupAverages` stays supported for read (back-compat) but is only consulted when the flag is set.
- Migration: on load, if a floor has `transitionGroupAverages[key]` set, mark every existing transition in that group with `useGroupAverage: true` so current projects behave the same as before this change. New doorways default to their own measurement.

## Not in scope

- No UI redesign of the Transitions sheet beyond the toggle.
- No change to raw reading storage.
- No touch to anchors, chains, or notes.

## Verify

- Open the affected house: downstream points should snap back to `raw + this doorway's delta`.
- Keypad preview shows `9.30`, not `9.3000000000000002`.
- Toggling "use group average" on a doorway reproduces the old behavior for that doorway only.
