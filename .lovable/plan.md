Add a red-yellow-green topo palette with red = low and green = high.

**What we're changing:**
- Add a new palette option called "red-yellow-green" (label: "Red-Green") to the topo palette picker.
- Low elevation (t=0) renders red, middle renders yellow, high elevation (t=1) renders green.
- The existing "Reverse palette" toggle still works if you ever want to flip it.

**Files:**
- `src/lib/types.ts` — add `"red-yellow-green"` to the `RenderSettings.palette` union.
- `src/components/tabs/TopoTab.tsx` — add the label, add it to the primary palette list, and implement the 5-stop RGB interpolation in `paletteColor()`.

**Color stops (low → high):**
```text
red    [220, 40, 40]
orange [230, 100, 40]
yellow [255, 235, 60]
lime   [150, 210, 60]
green  [34, 160, 50]
```

**Open question:** Do you want this to become the default palette for new/fresh projects, or stay as one option in the picker?

**Verification:** After implementing, switch to the new palette in the Topo tab and confirm the lowest areas show red, middle areas yellow, and highest areas green.