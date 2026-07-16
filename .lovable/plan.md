# Multi-select + group-drag (Align mode only)

Confirming scope: **yes, this only lives inside Align mode's "Move points" sub-mode**, which is only reachable from the ⋯ menu → "Replace plan image…" on a V2 project. The normal field screen stays single-tap, single-drag — untouched.

## Interaction

Inside Align mode, after toggling into the **Move points** sub-mode:

1. A **Select** pill appears in the Align toolbar.
2. Tap **Select** → enters multi-select. Points get a subtle "selectable" look.
3. Tap a point → toggles it in/out of the selection (selected points get a ring).
4. Drag any selected point → the whole selected group moves together, preserving relative offsets.
5. Tap **Select** again → exits multi-select and clears the selection.

Single-point drag still works whenever Select is off, same as today.

## Scope guardrails

- Not available in the normal Field screen.
- Not available in Align mode's image-move / scale / rotate tools.
- Not available on V1 projects at all.
- No keyboard modifiers required — pure touch/click.

## Files touched

- `src/components/AlignPlanMode.tsx` — add Select pill to the toolbar, track `selectMode` + `selectedIds` state local to Align mode.
- `src/components/AlignPlanMode.tsx` point overlay — tap toggles selection when `selectMode` is on; drag on a selected point moves the group.
- No changes to `FieldTab.tsx`, `DataPointsPanel.tsx`, or `PlanCanvas.tsx` core behavior.

## Acceptance

- On a V1 project: no Select pill anywhere.
- On a V2 project's Field screen: no Select pill.
- Inside Align → Move points → tap Select → tap 3 points → drag one → all 3 move by the same delta.
- Tap Select again → selection clears, single-drag works normally.
- Done commits, Cancel discards, same as the rest of Align mode.
