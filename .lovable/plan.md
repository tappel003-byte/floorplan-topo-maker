
# Align Mode (V2-only)

Goal: when the plan image behind a survey is a different size/aspect/angle than the one originally used, re-fit the **image** to the locked points instead of moving points one by one. Only available on duplicated (V2+) projects, so the original survey is always safe.

## Where it lives

- Project card ⋯ menu on a V2 project gains one new entry: **"Replace plan image…"**
- Original (non-duplicated) projects do **not** show this entry. Rule: if the project has no parent lineage marker, the option is hidden. Prevents accidental destruction of a real survey.

## Flow

1. User taps **Replace plan image…** on a V2 card.
2. File picker → pick new image (photo, screenshot, PDF page export — same formats as today's initial upload).
3. App enters **Align mode** on that project:
   - New image loads underneath the existing points at a sensible default fit (contained, centered).
   - Points render locked (no drag) with a subtle "locked" visual state.
   - A floating **Align toolbar** appears (dismissible, like the Data pill).
4. User adjusts until walls line up with dots.
5. Tap **Done** → new image + transform are saved, points untouched, Align mode exits. Tap **Cancel** → revert to previous image, nothing saved.

## Align toolbar (only visible in Align mode)

Three tools, in order of "least risky → most risky":

1. **Move image** — one-finger drag on the image pans it under the points.
2. **Scale image** — pinch on the image, or +/- stepper for fine control. Uniform scale only (no independent X/Y — protects aspect ratio).
3. **Rotate image** — two-finger twist, or a rotation stepper in 0.5° increments. Only needed for the "rounded plan set" case you described.

Escape hatch for the last-mile cleanup after image is roughly aligned:

4. **Move points** sub-mode toggle — flips the lock: image freezes, points become draggable, and **multi-select + group-drag** becomes available here (Shift/tap-to-select rows, then long-press any selected point to move the whole group). This is the same behavior we discussed earlier, but *only reachable from inside Align mode on a V2*, so the everyday field screen stays simple.

Only one tool is active at a time. Toolbar shows which is active.

## What gets saved

Per project: `planImageId` (new blob), `planTransform: { tx, ty, scale, rotation }`. Points' `(x, y)` are stored in the same coordinate space as before — they don't move unless the user explicitly used the "Move points" sub-mode.

Undo/redo works inside Align mode (each transform change = one history step). Exiting via **Done** commits; **Cancel** discards the whole session.

## What we are NOT building in this pass

- No auto-alignment / feature detection ("snap walls to points"). Manual only.
- No non-uniform scale, no shear, no perspective correction. If a photo is that distorted, retake it.
- No alignment tools on original projects. V2-only, full stop.
- No multi-select or group-drag anywhere *outside* Align mode. The field screen keeps single-point drag.

## Technical notes

- Add `parentProjectId` to the project record when `duplicateProject` runs, so we can detect "is this a V2" without name-parsing.
- `PlanCanvas` gains a `mode: 'field' | 'align-image' | 'align-points'` prop; existing pointer handlers branch on it. Points' rendering is unchanged; only their pointer targets change.
- `planTransform` is applied as a CSS transform on the image layer only, so rendering points on top costs nothing extra and no coordinates get rewritten.
- Topo, transitions, notes, exports — all unaffected. They read point coordinates, which never change unless the user opted into the points sub-mode.

## Acceptance

- On a V1 (original) project card, no "Replace plan image" entry exists.
- On a V2 project card, tapping it enters Align mode; new image loads under locked points.
- Move / scale / rotate the image; walls line up; tap Done; reopen project → image and alignment persist, points are in identical coordinates as before.
- Enter Align mode again, switch to Move points sub-mode, group-move 5 points; tap Done → only those 5 points changed.
- Cancel from any state → nothing persists.
