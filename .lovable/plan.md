Tweak the New Mexico Sunset palette default and move the Reverse control.

1. **New Mexico Sunset default orientation** — swap the `nm-sunset` stops so the low end is pink and the high end is gray (current stops are gray-low → pink-high). This makes the palette match the user's intent out of the box; the existing Reverse switch can still flip it back.

2. **Move Reverse switch up** — relocate the Reverse toggle in the Palette panel so it sits at the top, above the palette list, instead of below it.

Scope: `src/components/tabs/TopoTab.tsx` only.
- Reverse the `nm-sunset` RGB array order.
- Reorder the `PalettePicker` / `CornerPanel` contents so the Reverse switch appears first.

No data model, math, or other UI changes.