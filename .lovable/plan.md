## Safety approach

Nothing existing gets deleted. Every change is either:
- a **new component file** placed alongside the old one, or
- a **swap at the render site** (one line in the parent) so the old component stays on disk and can be restored instantly.

No touching of `PlanCanvas`, gestures, elevation math, DB, transitions, or the keypad. All work is layout/chrome.

**Checkpoint discipline:** I stop after each of the 4 steps below so you can test on the live preview before I move on. If anything looks wrong, one revert click restores that step.

---

## Step 1 — Top bar (shared, both screens)

- New `AppTopBar.tsx`: title · Undo · Redo · `⋯` overflow (Review, Setup, Export, Clear, Delete).
- Remove fit-to-screen button.
- Old header component stays in the file tree, just unused.

## Step 2 — Data screen corners

- New `ReviewShortcut.tsx` — upper-left round icon. Tap opens a thin ribbon: point # · edit · delete. Tap point → detail window (edit value, delete, note).
- New `NoteTool.tsx` — upper-right round icon. Tap to arm; next canvas tap drops a flag pin → text/dictation box. Flag pins are a new point type, stored separately, excluded from topo/exports.
- New `ModeToggle.tsx` — lower-left **vertical** Data/Topo pill. Present on both screens.

## Step 3 — Topo screen corners

Three small round icons (same visual language as today's Topo gear), each closed by default:
- **Upper-left — Contours:** Mode, Step, First, Count, Line thickness, Contours on/off
- **Upper-right — Palette:** Palette picker, Reverse
- **Lower-right — Labels & Layers:** Labels on/off, Decimals, Label bg, Label style, Floor plan, Points, Legend, High/low pins

Old monolithic Topo panel component stays in the repo, just no longer mounted. Kill the "long-press… undo" hint block. Drop Reset.

## Step 4 — Review view (from `⋯`)

- Full-screen review. Notes render **inline on each point row** (not a separate section).
- Tap row → detail window (edit / delete / note).
- Add-note canvas pins listed separately at the top or bottom of the same view (TBD when we get there).

---

## Technical notes

- New files under `src/components/chrome/` so nothing collides with existing components.
- Point type gains an optional `kind: "elevation" | "note"` and optional `note: string`; default `"elevation"` so existing saved projects keep working untouched. No DB migration — IndexedDB schema is permissive.
- Rendering swap happens in the screen container files only. Old components remain importable.

If any step breaks something, use the revert button on that step's message — earlier steps stay intact.
