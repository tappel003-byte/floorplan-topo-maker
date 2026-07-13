## Add contour palettes + rename Brown

**Rename**
- `brown` → display label **"Earth Tone"** (keep internal id `brown` so existing saved settings still work).

**Palette picker layout**
Two-tier UI in the Topo palette panel:
- **Primary row (always visible):** Earth Tone, Rainbow, Blue–Red, Gray
- **More palettes ▾ (collapsed by default):** Ocean, Sunset, Forest, Viridis, Topographic, Grayscale-Amber, New Mexico Sunset
- If the currently selected palette lives in the collapsed group, the group auto-expands on open so the active choice is always visible.

**New palettes** (RGB stops added to `paletteColor()`):
1. **Ocean** — deep navy → teal → aqua → pale sand
2. **Sunset** — deep purple → magenta → orange → gold
3. **Forest** — dark green → moss → olive → cream
4. **Viridis** — purple → blue → green → yellow (perceptually uniform)
5. **Topographic** — green lowlands → tan → brown → white peaks
6. **Grayscale-Amber** — gray ramp with an amber highlight band
7. **New Mexico Sunset** — slate gray → warm gray → dusty mauve → coral pink → glowing pink (placeholder stops; user will share a reference photo later to tune)

**Scope**
- `src/lib/types.ts` — extend `RenderSettings["palette"]` union with the 7 new ids.
- `src/components/tabs/TopoTab.tsx` — add RGB stops for each new palette in `paletteColor()`, replace the flat `<select>` with a two-tier picker (primary buttons + collapsible "More palettes" group), and swap the Brown label to "Earth Tone".

No data model, storage, or math changes. Existing projects keep their current palette selection.
