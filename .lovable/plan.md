
# Chained transitions: pick any ancestor as the "From" surface

## The problem

In `AddTransitionSheet`, when you add a transition while another is active, the **From surface** dropdown is disabled and locked to the *most recently active* transition's surface. If you walked Tile → Hallway → Bedroom1, then came back and want to go Hallway → Bedroom2, you can't say "from Hallway" — the app forces you to chain off Bedroom1 (or you re-measure the hallway from scratch, which is what you've been doing).

## The fix

Unlock that dropdown, but constrain it to the **surfaces of transitions in the current active chain only** — parent, grandparent, up to the chain root. Not every transition on the floor, not the full surface list.

So if the active chain is `Tile → Hallway → Bedroom1`, the From picker shows:
- Hallway (parent)
- Tile (root)

Pick one, and the new transition chains off *that* anchor. The reading-A input stays "raw on the selected surface," and the app converts it to base-frame using that ancestor's delta (same math as today, just resolved against the chosen ancestor instead of the immediate parent).

Both readings are still entered at the doorway — matches current behavior, keeps the manometer honest.

## Out of scope

- Custom label for "Other" surface (Sunroom linoleum, etc.) — separate issue, worth its own plan.
- Picking anchors outside the active chain — you said "in that chain only."
- Reusing a stored reading instead of re-measuring — not doing it; you enter both readings fresh at each doorway.

## Technical notes

- `AddTransitionSheet.tsx` currently takes a single `parentDelta` + `parentSurface`. Change to accept the full ancestor chain (id, surface, cumulative delta to base) and render them as options in the From select.
- When the user picks an ancestor, use *that* ancestor's cumulative delta as `parentDelta` for the conversion, and set the new transition's `parentId` to that ancestor's id.
- Caller (`FieldTab`) walks `parentId` links from the active transition up to the root to build the ancestor list.
- No data-model change. `Transition.parentId` already supports arbitrary chain re-parenting.
