## v1 Polish Pass — items 1–4

Ship the four foundation improvements in one build, in this order so each step de-risks the next.

### 1. Landscape phone fix
The current layout breaks when a phone rotates to landscape (tabs/keypad eat the canvas). Fix by:
- Letting the main tab container use `h-[100dvh]` (dynamic viewport) instead of any fixed height assumptions.
- Making the tab bar and status row `shrink-0`, canvas `flex-1 min-h-0`, so the plan always claims leftover height.
- Numeric keypad: cap at `max-h-[90dvh]` with internal scroll so it never pushes the canvas offscreen in landscape.

No behavior changes, just layout.

### 2. Hide point numbers on the plan
In `FieldTab` and `ReviewTab` canvas overlays, stop drawing the index number inside the dot. Keep drawing the elevation value next to the dot — that becomes the point's visible identity. Numbers still exist in data, CSV, and the (upcoming) panel.

Base point stays visually distinct (green + "BP1" label).

### 3. Two-way row ↔ point selection (foundation)
Introduce a lightweight selection model shared by the canvas and any list view:
- Add `selectedPointIds: Set<string>` state at the `projects.$id` route level (so it survives tab switches).
- Canvas: tapping a point toggles selection; selected points render with a highlight ring. Tapping empty space clears (unless in add-point mode on FieldTab — there, tap-empty still creates a point; selection is via tapping an existing point).
- Expose selection + setter to child tabs via props.
- ReviewTab's existing list gets row highlight bound to the same set; clicking a row selects the point and (optionally) pans it into view — pan can come later if it's fiddly.

Multi-select via shift/long-press deferred to when we actually need bulk ops (transitions v2).

### 4. Movable Data Points panel
On FieldTab (and later ReviewTab), add a floating, draggable, collapsible panel:
- Default position: top-right, ~280px wide, ~40% viewport tall.
- Header: drag handle, collapse chevron, point count.
- Body: virtualized-ish list (simple map is fine at current scale) with columns `#` and `value` by default; expand toggle reveals `x, y, notes`.
- Row click → selects that point (uses the model from step 3). Selected point's row auto-scrolls into view when selection changes from the canvas.
- Position persisted to `localStorage` per project id. Collapsed state persisted too.
- Fully dismissible via an "X" — a small floating "Data" pill in the corner brings it back.

CSV export column already covered by existing ExportTab; not touching it here.

### Out of scope (explicit)
- Transitions (all flavors) — v2.
- Canvas-first redesign of other controls — v3.
- Field vs Desktop mode split — v3.1.
- Landscape *beauty* (repositioning keypad to the side, etc.) — only the breakage is fixed here.

### Technical notes
- New file: `src/components/DataPointsPanel.tsx` (draggable via pointer events, no new deps).
- Selection state lifted to `src/routes/projects.$id.tsx`; passed into `FieldTab` and `ReviewTab` as `{ selectedIds, setSelectedIds }`.
- `PlanCanvas` unchanged — selection ring is drawn by the tab's `drawOverlayTop`.
- No schema/db changes. No new packages.

### Verification
- Rotate preview to landscape on a phone viewport → canvas visible, keypad usable.
- Add points → numbers no longer on dots, values still shown.
- Tap a point → ring appears; tap panel row → same point rings.
- Drag panel → stays where dropped after reload.
