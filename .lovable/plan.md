## Transition surface labels + base-grouped averaging

### Surface list (compound where base matters)
- Tile
- Concrete/slab
- Subfloor
- Carpet/slab
- Carpet/subfloor
- Other (user-defined text — already planned separately)

Every surface has an implicit **base**: `slab` or `subfloor` (Tile has no base tag — it stays neutral unless you tell me otherwise).

### Averaging groups by base
When the app computes averages across transitions, it groups by structural base, not by finish:

- **Slab group:** `Concrete/slab`, `Carpet/slab`
- **Subfloor group:** `Subfloor`, `Carpet/subfloor`
- **Tile:** its own group (no base tag)
- **Other:** its own group per custom label

So a `Tile → Carpet/slab` delta and a `Tile → Concrete/slab` delta get averaged together, because both are "tile to slab."

### What changes in code
- `src/lib/surfaces.ts` (or wherever the surface list lives): replace `Carpet` / `Concrete` with the compound names above, add `base: 'slab' | 'subfloor' | null` metadata per surface.
- `AddTransitionSheet.tsx`: dropdown reflects the new list.
- Averaging logic in the transitions module: group deltas by `(fromBase, toBase)` instead of `(fromSurface, toSurface)`.
- Existing saved projects: old `"Carpet"` / `"Concrete"` strings stay readable; a tiny migration maps `Carpet → Carpet/slab` and `Concrete → Concrete/slab` on load (safe default — you can change any point manually).

### Not included
- The "Other = user-defined text" work is a separate already-agreed item; I'll fold it into the same build pass but list it here so nothing gets lost.
- No changes to point capture, chaining, or the hub-branch picker.

Confirm and I'll build it.
