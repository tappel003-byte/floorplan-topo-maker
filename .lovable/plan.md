Move the "Red → Green" palette entry from the primary palette list to the "More palettes" list in the Topo tab picker.

**What we're changing:**
- In `src/components/tabs/TopoTab.tsx`, remove `"red-yellow-green"` from `PRIMARY_PALETTES`.
- Add `"red-yellow-green"` to `EXTRA_PALETTES`.

**Result:**
- Primary list shows: Earth Tone, Rainbow, Blue → Red, Grayscale.
- "More palettes" expands to show: Red → Green, Ocean, Sunset, Forest, Viridis, Topographic, Gray + Amber, New Mexico Sunset, Mountain Top.

**Verification:**
- Open the Topo tab palette picker, confirm Red → Green is no longer visible by default and appears after tapping "More palettes".