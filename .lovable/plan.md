Lock transition averaging to the correct grouping rule.

## The rule

Group key is `<A-side> → <B-side>`, where each side is normalized as:

- `Carpet/slab` and `Concrete/slab` → `slab`
- `Subfloor` and `Carpet/subfloor` → `subfloor`
- Everything else (Tile, Hardwood, Engineered wood, Laminate, LVP, Vinyl sheet, Linoleum, and any custom "Other" text) → kept as its exact literal name.

Custom "Other" values must match exactly (trimmed of surrounding whitespace, otherwise byte-for-byte, case-sensitive) to share a group. Two doorways where one is typed "Rubber" and the other "rubber" are two separate groups.

Examples:
- `Tile → Carpet/slab` and `Tile → Concrete/slab` → same group (`Tile → slab`), averageable.
- `Tile → Hardwood` and `Tile → Laminate` → two separate groups, never averaged.
- `Carpet/slab → Hardwood` and `Concrete/slab → Hardwood` → same group (`slab → Hardwood`).
- `Carpet/subfloor → Tile` and `Subfloor → Tile` → same group (`subfloor → Tile`).
- `Tile → Rubber` (Other) and `Tile → rubber` (Other) → different groups.

## Changes

1. Restore structural collapsing in `transitionGroupKey`, but only for the four `/slab` and `/subfloor` compound labels — every other surface (including "Other" custom names) stays literal.
2. Display labels in the Transitions sheet header and the floating "Averaged corrections used" chip show the normalized pair (e.g. `Tile → slab`) so it's obvious what's being lumped. Each doorway row inside a group still shows its full literal `surfaceA → surfaceB` so you can see the specific pairs.
3. Keep the current behavior that applying an average only flips `useGroupAverage` on transitions inside that same normalized group — no cross-group bleed.
4. Update legacy-migration comments in `src/routes/projects.$id.tsx` to describe this rule accurately.
5. Add focused checks: `Tile→Carpet/slab` + `Tile→Concrete/slab` group together; `Tile→Hardwood` + `Tile→Laminate` do not; two "Other" values only group when the trimmed text matches exactly (case-sensitive).

## Technical details

- Files: `src/lib/transitions.ts` (grouping + labels), `src/components/TransitionsSheet.tsx` (group header uses normalized label, rows keep literal names), `src/components/chrome/AveragedCorrectionsChip.tsx` (normalized label), `src/routes/projects.$id.tsx` (comment cleanup only).
- No changes to the field entry flow, transition creation, or the surface picker list.
- No averaging across different literal surfaces beyond the `/slab` and `/subfloor` collapse defined above.