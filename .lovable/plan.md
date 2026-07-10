Move the Data/Topo mode pill to the background chrome layer so it never covers open dialogs or data-input windows.

**Change:**
- `src/components/chrome/ModeToggle.tsx` (or wherever the pill is rendered): lower its z-index from `z-[65]` to `z-10` so it stays above the canvas but below the top bar, floating tools, and any dialogs.

**Not touching:** canvas, points, data, topo, review, top bar, or styles.css.