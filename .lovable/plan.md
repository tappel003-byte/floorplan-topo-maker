Lock every piece of chrome so only the canvas moves, and make the Setup cross-hatch transparent.

## 1. Transparent cross-hatch — `src/lib/exclusions.ts`

When `hatched: true`:
- Remove the white fill so the plan shows through underneath.
- Draw a true cross-hatch: two sets of diagonals at ~16 px spacing, single light stroke color, so it reads as crossing lines instead of the current dense checker/diamond grid.
- Keep the solid outline.

Topo tab (white fill + outline) and Data tab (no draw) are unchanged.

## 2. Lock all chrome in place

The top bar and tabs are already fixed. The pieces that drift are the floating pills and the chips inside them. Lock every one of them to a fixed screen position; only the canvas pans/zooms underneath.

- **`StatsChip.tsx`** — remove drag handlers, position state, and localStorage. Pin to bottom-center, just above the Data/Topo row. Keep tap-to-highlight on High/Low.
- **`AveragedCorrectionsChip.tsx`** — remove drag + persisted position. Pin to bottom-right (mirrors `ModeToggle` on the left).
- **`ModeToggle.tsx`** — already fixed bottom-left, no change.
- **`ReviewShortcut.tsx`** — already fixed, no change.
- **`DataPointsPanel.tsx`** — audit and, if it currently drags/persists position, pin it to a single fixed slot too. Collapse/expand still works; it just doesn't move around the screen.

Result: every control stays exactly where it lives every time the app opens; the plan/canvas is the only thing that moves.

## Out of scope

Topo/Data exclusion rendering, transitions, keypad, and Setup vertex-drag all stay as they are.
