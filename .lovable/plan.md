Align the Database icon button's baseline with the Note pill.

**File**: `src/components/DataPointsPanel.tsx`, hidden-state button (line ~175) and matching open panel offset for `landscape-short` if needed.

**Change**: add `1.75rem` (h-7 floor-selector height) to the `top` offset when a floor selector row is present, so the Database chip sits on the same baseline as the Note pill inside FieldTab.

- Add prop `hasFloorSelector?: boolean` to `DataPointsPanel`.
- In `src/routes/projects.$id.tsx`, pass `hasFloorSelector={floors.length > 1}` where the panel is rendered.
- In the panel's hidden-button `className`, replace `top-[calc(env(safe-area-inset-top)+2.75rem)]` with:
  `top-[calc(env(safe-area-inset-top)+2.75rem+var(--fs-offset,0rem))]` and set `style={{ ["--fs-offset" as any]: hasFloorSelector ? "1.75rem" : "0rem" }}`.
- Height stays `h-9` (already matches Note pill).
- No other layout changes.