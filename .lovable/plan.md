## Shared label font size

Add a single `labelFontSize` setting that controls the elevation label text on both the plan (Field/Data view) and the Topo view. A stepper appears in both the Data panel and the Topo controls — change it from either screen and the other follows.

### What gets added

1. **New shared setting: `labelFontSize`**
   - Stored in localStorage alongside the existing `pointSize` / `dotSize` settings.
   - Range: `8px – 24px`, default `11px` (matches current label size).
   - `–` / `+` steppers in 1px increments, matching the existing "Dot size" row.

2. **Data panel control**
   - New row directly under Dot size: `TEXT   [ – ]  11px  [ + ]`
   - Same visual treatment as the current px stepper.

3. **Topo panel control**
   - Same `TEXT [ – ] 11px [ + ]` stepper in the Topo controls, near the existing point/legend size controls.

4. **Rendering**
   - Plan labels (Field/Data canvas): elevation text uses `labelFontSize`.
   - Topo labels: elevation text uses `labelFontSize`.
   - Dot size and legend size are unchanged — this only touches label text.

### Not in scope

- No desktop-mode work — parked per your note.
- No change to dot rendering, note pins, diamonds, legend sizing, or PIN badges.

### Technical notes

- Add `labelFontSize` to the same context/store that already holds `pointSize`, same persistence pattern.
- Files likely touched: `DataPointsPanel.tsx`, `TopoTab.tsx`, `PlanCanvas.tsx` (label draw call), and the settings/context module.
- Both steppers bind to the same state so edits from either screen propagate immediately.
