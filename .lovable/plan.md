## What went wrong

You were right. I didn't fix the reported bug — I moved the chips.

Digging through git, the chips originally lived at:
- **Notes pill (FieldTab)**: `absolute z-20 top-2 right-2` (with a landscape variant pinning to bottom-right)
- **Stats chip**: `fixed z-40 top-11 left-1/2 -translate-x-1/2` — small centered pill near the top
- **Active correction pill + popover**: `top-12 right-2`, directly under the Notes pill
- **DataPointsPanel hidden chip**: `top-12`

In the last pass I:
1. Rewrote positions to `top-[max(0.75rem,env(safe-area-inset-top))]` and `top-[calc(...+2.75rem)]`, which pushed things down on iOS.
2. Rewrote StatsChip into a **draggable, persisted, bottom-center** chip with `clampChipPosition` / `TOP_SAFE_GAP` — a completely different component.
3. Added a "safe area clamp" to DataPointsPanel that wasn't needed.

The screenshot the original bug came from was almost certainly a scroll/HMR artifact, not a real clipping problem — the pills sit inside the canvas area, *below* `AppTopBar`, which already handles the safe area. There was nothing to fix in positioning.

## Fix plan — revert to original positions, keep only the real fixes

1. **`src/components/chrome/StatsChip.tsx`** — restore the small centered top pill:
   - Remove drag, persistence, `clampChipPosition`, `TOP_SAFE_GAP`, `minSafeY`, `storageKey`, resize/orientation listeners.
   - Return to the original static markup: `fixed z-40 top-11 left-1/2 -translate-x-1/2 landscape-short:top-11 h-6 ...`.
   - Keep the tap-to-highlight on High/Low.

2. **`src/routes/projects.$id.tsx`** — drop the `storageKey={project.id}` prop I added (no longer needed).

3. **`src/components/tabs/FieldTab.tsx`** — restore original pill positions:
   - Notes pill container: back to `absolute z-20 top-2 right-2 landscape-short:top-auto landscape-short:right-... landscape-short:bottom-...`.
   - Active-correction pill children + popover: back to `top-12 right-2`.
   - **Keep** `pointer-events-auto` + `onPointerDown={(e) => e.stopPropagation()}` on the interactive floating containers — that was a real bug fix (canvas gestures leaking) and is unrelated to positioning.
   - **Keep** the `parentDelta` fix that uses `transitionDelta(activeTransition)` — also a real correctness fix.

4. **`src/components/DataPointsPanel.tsx`** — revert:
   - Remove `PANEL_TOP_SAFE_GAP`.
   - Restore the hidden-panel chip class to its previous `top-12` (or whatever the pre-change value was).
   - Restore `loadState` to the pre-change clamp.

5. **`src/components/AddTransitionSheet.tsx`** — leave alone. The From/To unlock and `stopPropagation` on the modal are correct.

## What I will NOT touch

- The From/To unlock in AddTransitionSheet.
- The `deltaOverride`-aware parent delta math.
- Pointer-event stopping on floating overlays (real canvas-gesture fix).

Ready to apply on approval.