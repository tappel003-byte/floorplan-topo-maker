
## What changes

### 1. Rename "Active: {surface} chain" → "Active correction"

The amber pill and popover header both drop the surface-in-name phrasing. The chain's baseline surface still appears in the caption ("All corrections resolve back to Tile") so the reference isn't lost.

### 2. Let baseline-surface readings belong to the chain

Today only downstream points (Carpet, Hardwood) get tagged with a `transitionId`. A reading taken on the chain's baseline surface (the Tile 9.00 inside the office) has no link, so the halo skips it.

Two ways to attach:

- **At entry time** — when a chain is active and the keypad shows the surface-choice row, add the baseline surface itself as a chip (e.g. `Tile (baseline)`). Tapping it stores the point with `transitionId = chainRoot.id` and a new `isChainBaseline: true` flag. Correction math treats these as +0.0, so the label stays plain ("9.00", no `+delta` suffix).
- **Retroactively** — in `PointDetail`, add an "Attach to active correction (baseline)" action visible only when a chain is armed and the point currently has no `transitionId`. Same result as above.

Highlight logic already lights up any point whose `transitionId` is in the chain, so both paths flow through the existing halo code with no changes there.

### 3. Manual override for a link's correction

In the chain popover, tapping a row currently opens the full `TransitionDetailDialog`. Add a lighter inline path: each row becomes a two-part control — the surface pair on the left (still opens the full dialog on tap for editing readings/surfaces), and the delta value on the right becomes a small editable field. Typing a new number and blurring/entering commits an `deltaOverride` on the transition record.

Data-model change: `Transition.deltaOverride?: number`. `transitionDelta(t)` returns `t.deltaOverride ?? t.readingA - t.readingB`. If the user later edits the underlying readings in the detail dialog, the override is cleared (readings are the source of truth again) — with a small "Override active — editing readings will clear it" hint shown in the dialog when an override exists.

Overridden rows in the popover get a subtle indicator (e.g. dot + tooltip "Manual override") so it's obvious the number no longer matches raw A−B.

## Files touched

- `src/lib/types.ts` — add `deltaOverride?: number` to `Transition`; add `isChainBaseline?: boolean` to `SurveyPoint`.
- `src/lib/transitions.ts` — `transitionDelta` respects override; `correctedValue` returns raw value unchanged for `isChainBaseline` points (delta is 0).
- `src/components/tabs/FieldTab.tsx` — rename pill/popover title; render popover row with inline delta editor + override indicator; pass baseline-surface chip into keypad; handle baseline-tag on point placement.
- `src/components/NumericKeypad.tsx` — surface-choice row includes the chain baseline surface as an explicit option.
- `src/components/PointDetail.tsx` — add "Attach to active correction (baseline)" button (visible only when a chain is active and point is unlinked).
- `src/components/TransitionDetailDialog.tsx` — show override-active hint; clear `deltaOverride` when readings change.

## Not in scope

- No changes to Topo / Export / Review — corrected values already flow through `correctedValue`, which stays the single source of truth.
- No change to how chains are built or how the diamond anchor behaves.
