## Fix: selected point should show a blue halo on the canvas

### What's happening
When you tap a row in the Data panel (e.g., point 21 = 9.50), the canvas pans/zooms to that point (`focusRequest` fires), but nothing on the canvas visually marks it. There is halo logic in `FieldTab.tsx` `drawOverlay`, but it only lights up yellow rings for points tied to an active/viewed **transition chain**. There is no branch that reads `selectedIds` and draws a ring around a normally-selected point.

That's why it feels like functionality regressed — the pan works, but the "which dot am I looking at" cue is missing.

### Fix (one file, ~6 lines)
`src/components/tabs/FieldTab.tsx`, inside the existing `drawOverlay` loop (around line 945, right after the marker is drawn, before the transition-highlight block):

- Add: `const isSelected = selectedIds.has(p.id);`
- If `isSelected`, stroke a blue ring (`#2563eb`, lineWidth 2) at radius `markerR + 4` (or `+5` for anchors, matching the yellow ring math).
- Keep the yellow transition ring exactly as-is — the two can coexist (blue for user selection, yellow for chain membership). If a point is both, both rings render (yellow is slightly larger, so they nest cleanly).

No other files change. No data model change. No effect on transitions, notes, or the keypad flow.
