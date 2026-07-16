## Group drag on existing selection

Drag any selected point and every other selected point moves by the same offset. If you drag an unselected point, behavior is identical to today (drag that one point only).

### Behavior

- **Trigger:** long-press on a point that is part of the current selection (`selectedIds.size > 1` and the pressed point's id is in the set). Same long-press gesture as today — no new mode, no new UI.
- **During drag:** every selected point translates by the same `(dx, dy)` in image coordinates. Non-selected points don't move.
- **Drop:** all moved points are persisted (one save per point) and a single history snapshot is committed, so one Undo restores the whole group.
- **Fallback:** dragging a point that isn't in the selection → today's single-point drag, unchanged.
- **Cancel/pinch:** if pinch-zoom preempts the drag, the group snaps back exactly like a single point does today (drag state is dropped before any writes).

No lasso, no marquee, no select-mode toggle. Selection is built the way it already is — tapping rows in the Data panel or tapping a point on the plan.

### Technical details (in `src/components/tabs/FieldTab.tsx`)

The drag handler around lines 700–898 is the only surface that changes. Concretely:

1. Extend `DragState` with `originsById: Map<string, {x, y}>` — the starting positions of every selected point at pointer-down, captured only when the pressed point is in `selectedIds` and the set has >1 member. Otherwise leave it undefined (single-point path).
2. In `onImagePointerMove` (line 802), when `originsById` exists, compute `dx = nx - drag.origX`, `dy = ny - drag.origY` and map over `points` applying the offset to every id in `originsById`. Single-point path unchanged.
3. In `onImagePointerUp` (line 893), when `originsById` exists, `await savePoint` for each moved point, then one `commitSnap(nextPts)`.
4. Cancel path (line 809) needs no change — dragRef is cleared and no writes happen, so points revert on next render from the last saved state. Because move updates go through `onPointsChange` optimistically, we also need to restore originals on cancel: on cancel, if `originsById` exists, call `onPointsChange` with points reset to their origins (mirrors what single-point does implicitly since only one point was moved from its saved value).

No changes to `PlanCanvas`, selection code, keypad, undo/redo plumbing, or the Data panel.

### Out of scope

- Lasso / marquee selection on the canvas
- Rotating or scaling the group
- Snap-to-grid or align helpers
- Group drag for note pins (notes keep today's single-pin drag)

### Verification

- Multi-select 3 points in the Data panel, long-press one on the plan, drag → all 3 slide together; release → all 3 persist; one Undo restores all 3.
- Long-press a point that is NOT in the selection → only that point moves (regression check).
- Start a group drag, put a second finger down → drag aborts cleanly, no points shifted.
