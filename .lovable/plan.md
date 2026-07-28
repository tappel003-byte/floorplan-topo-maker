## Problem

In Setup → Boundary → **Excluded areas**, while dropping points to draft a new excluded shape, the vertices you just placed can't be repositioned. Only Undo works. Boundary vertices, by contrast, are draggable immediately.

Root cause: in `BoundaryPanel` (`src/components/tabs/SetupTab.tsx`), `findVertexAt` and the pointer-down/move/cancel handlers only know about `boundary` vertices and **saved** exclusion vertices. The in-progress `draft` array is never checked, so a touch on a draft vertex falls through to `onTap`, which just appends another point.

## Fix

Make draft exclusion vertices draggable using the same long-press-free drag pattern already used for boundary vertices.

1. Extend the drag `target` union to include `"draft"`.
2. In `findVertexAt`, when `drafting` is true also iterate `draft` and return `{ target: "draft", index }` on a hit.
3. In `onImagePointerDown`, handle the `"draft"` case: seed `dragRef` with the original draft point.
4. In `onImagePointerMove`, when target is `"draft"`, update `draft[index]` via `setDraft`.
5. In `onImagePointerCancel`, restore the original draft point on cancel (matches boundary behavior).
6. In `onTap`, if `findVertexAt` returns a hit while drafting, do not append a new point (mirrors the boundary tap guard).

No changes to saved-exclusion behavior, boundary behavior, `PlanCanvas`, or data model. Scope is entirely inside `BoundaryPanel`.

## Files

- `src/components/tabs/SetupTab.tsx` — `BoundaryPanel` only
