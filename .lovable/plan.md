## Fix chain-root highlight + add baseline caption in two places

### 1. Chain-root anchor joins the yellow halo
The tile-side "9.00" at the top of the office doorway is the reference every downstream reading in the chain is corrected back to, but it carries no `transitionId` — so today the halo predicate skips it and the visual chain looks incomplete.

- In `FieldTab.tsx`, extend the "highlight this chain" id set to also include the anchor point of the root transition (the point whose stored value equals the root transition's `readingA`, i.e. the tile-side baseline).
- Result: tapping the amber pill lights up every diamond + every downstream reading + the tile-side chain-root anchor.

### 2. "Resolves back to baseline" caption — chain popover
Leave the row structure and the pairwise +/− deltas exactly as they are — the math is right and the string of signs is how each link corrects the previous corrected value back to the baseline. Add one caption under the header so the reader knows how to parse it.

```text
CHAIN CORRECTIONS — TAP TO EDIT
All corrections resolve back to Tile
  Tile → Carpet        +0.5"
  Carpet → Hardwood    −0.2"
```

- Caption text: `All corrections resolve back to {baselineSurface}`, where `baselineSurface` = the root transition's `surfaceA`.
- Small, muted styling under the header; not a row, not tappable.

### 3. Same caption in the data-entry keypad
When `NumericKeypad` is in transition mode (surface-choice row visible, live corrected-value preview showing), add the same one-line caption so the user sees it at the moment they're entering a corrected reading — not only after the fact in the popover.

- Place: inside `NumericKeypad.tsx`, at the top of the transition/surface-choice section (above the surface buttons), same muted styling as the popover caption.
- Text: `All corrections resolve back to {baselineSurface}` — baselineSurface derived by walking `parentId` from the active transition up to the chain root and reading its `surfaceA`. For a brand-new chain (no parent), baseline = the current transition's own `surfaceA`.

### Technical notes
- `FieldTab.tsx`: when building the chain-highlight id set, also match the anchor point tied to the root transition. Verify against the current data shape when implementing.
- New shared helper (likely in `src/lib/transitions.ts`), e.g. `getChainBaselineSurface(transitionId, transitions)` — used by both the popover and the keypad so the caption never drifts.
- No schema changes, no changes to correction math, no changes to point labels on the canvas.
