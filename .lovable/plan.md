## Change
In `src/components/tabs/TopoTab.tsx`:

1. Replace the `LayerRow` block for "Contours" with a simple toggle row (matching the existing `Show floor plan`, `Labels`, etc. rows).
2. Remove the now-unused `LayerRow` helper component.

## What stays
- The `Show contours` on/off switch remains.
- The `Line thickness` slider remains unchanged as requested.
- `contourOpacity` still defaults to `1` in `RenderSettings`, so rendering behavior is unchanged — only the UI control is removed.

## Out of scope
- No changes to line thickness or other topo controls per your note that you want to improve that screen soon.