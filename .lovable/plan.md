## Make the active-chain pill interactive

**Tap the amber "Active: Carpet chain" pill** → opens a small popover listing every link in the active chain (root → … → current), each row showing its surface pair and current correction (e.g. "Carpet → Wood +0.30", "Wood → Tile +0.15"). Tapping a row opens that transition's existing `TransitionDetailDialog` so any correction in the chain can be edited or deleted. Editing a link recomputes downstream corrections as it does today.

**Selection highlight** → while the pill is active (or its popover is open), every point that references ANY transition in the chain (anchors + downstream, at every link) gets the existing yellow halo — not just the current link's downstream points.

### Technical notes
- `FieldTab.tsx`: pill becomes a button; add popover state; walk `parentId` from active transition up to root to build the chain list; extend the halo predicate to `transitionId ∈ chainIds` instead of a single id.
- Reuse `TransitionDetailDialog` unchanged for editing; position it near the pill.
- No schema/data changes.
