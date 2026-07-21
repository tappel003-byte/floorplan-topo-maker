# Finishing Screen — Build Plan (V2)

Desktop-first consolidation screen. Reuses existing render pipeline; no new topo math. Target: **80–90 credits total**.

## Layout (locked)

```text
┌─────────────────────────────────────────────────────────────┐
│  Header: project · floor · [Back to Field] [Export]         │
├──────────────┬──────────────────────────────┬───────────────┤
│  LEFT        │                              │  RIGHT        │
│  Data panel  │        CANVAS (topo)         │  Contour      │
│  - points    │                              │  Palette      │
│  - visibility│                              │  Labels/Text  │
│  - stats     │                              │  Boundary     │
│              │                              │  Exclusions   │
└──────────────┴──────────────────────────────┴───────────────┘
```

Groups are collapsible cards. No drag/float in v1 — keep it a molehill.

## Steps

**1. Persistence: `finishingSettings` on Floor (~8 cr)**
- Add optional `finishingSettings?: RenderSettings` to Floor type.
- Migration: on first Finishing open, seed from current `renderSettings`.
- Bundle export/import already generic — verify roundtrip, no schema bump.

**2. Route + shell + desktop gate (~12 cr)**
- New route `/project/$id/floor/$fid/finishing`.
- Min-width gate (≥1024px): below that, show "Open on desktop" card with a copy-link button. No mobile layout work.
- Three-column CSS grid shell, header with Back/Export.

**3. Canvas wiring (~10 cr)**
- Mount existing topo renderer bound to `finishingSettings` (not `renderSettings`).
- Read-only for points (no add/edit/drag here — Field owns capture).
- White background, existing zoom/pan.

**4. Right panel — settings groups (~20 cr)**
- Reuse existing controls from `TopoTab`: contour (interval, smoothing, legend size), palette, labels/text (high/low size, PIN visibility), boundary, exclusions.
- Group into 5 collapsible cards. All writes go to `finishingSettings`.
- This is the risk area — kept to reuse-and-regroup, no new controls.

**5. Left panel — data + stats (~15 cr)**
- Sortable point table (reuse Review table columns: PIN, X, Y, elevation).
- Row ↔ canvas selection (already wired pattern).
- Embed `TopoDiagnosticPanel` (high/low/delta) at top of left column.

**6. Export + polish (~10 cr)**
- "Export" button in header: same bundle path, now carries `finishingSettings`.
- Verify V1 bundles import cleanly (missing `finishingSettings` → seed from `renderSettings`).
- Empty states, loading, and a "Reset to Field settings" link in the header overflow.

**Total: ~75 credits estimated, 80–90 budget with headroom for step 4.**

## Out of scope (explicit)
- 3D model view (separate future build).
- Mobile Finishing layout.
- New topo math, new point editing, new export formats.
- Floating/draggable panels (revisit after v1).

## Assumptions
- Field screen and its settings remain untouched and authoritative for capture.
- `RenderSettings` shape is sufficient; no new fields needed for v1.
- Desktop = ≥1024px viewport; no tablet-landscape special case.

Ready for Tim's review.