# Remove Finishing screen from V1

V1 is Tim's live daily-use app. Finishing is the only entry point to the destructive plan-image swap, and point-dragging already exists in Topo and Data tabs — nothing else is lost.

## 1. What gets removed

**Deleted file**
- `src/components/AlignPlanMode.tsx` — sole consumer of the Finishing surface.

**Edited: `src/routes/projects.$id.tsx`**
- Remove the `AlignPlanMode` import.
- Remove the `finishingOpen` state and its `useEffect` that reads `#finishing` / `#cleanup` / `#align` hashes.
- Remove the `onOpenFinishing` prop passed to `AppTopBar`.
- Remove the `{finishingOpen && <AlignPlanMode … />}` block at the bottom of the JSX.

**Edited: `src/components/chrome/AppTopBar.tsx`**
- Remove the `onOpenFinishing?: () => void` prop, its destructure, and the "Finishing" `<MenuItem>`.
- The ⋯ button and menu itself stay. Review / Setup / Transitions / Export entries stay untouched.

## 2. What stays untouched

- `Floor.planTransform` field in `src/lib/types.ts`.
- `PlanCanvas.tsx` reading and applying `planTransform` when it draws the plan image.
- All persisted `planTransform` values in IndexedDB.
- Every other menu item, tab, chip, sheet, service worker, export/share/delete flow.

## 3. Data-safety confirmation

`planTransform` is a property on the `Floor` record, persisted in IndexedDB via `saveFloor`, and read directly by `PlanCanvas` on every render (`src/components/PlanCanvas.tsx` lines 48, 73, 199–208, 257). `AlignPlanMode` is only a **writer** — it lets the user edit `planTransform`. Removing it does not touch the reader path, the stored values, or the schema. Any floor previously aligned will continue to render with the exact same tx/ty/scale/rotation it has today. No migration needed, no visual regression, no data loss.

Bundle export/import (`src/lib/bundle.ts`) round-trips the full `Floor` object, so `planTransform` also survives export → import unchanged.

## 4. Credit estimate

~6–10 credits. Three small edits + one file deletion, no logic changes, no new tests, no schema changes.

## Approval

Waiting on Tim's explicit go-ahead before any code changes, per the V1-stability rule.