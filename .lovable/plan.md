Make the floating summary pill stay clear of the top chrome in landscape and stay repositionable anywhere on the screen.

### Problem
The High/Low/Δ pill can be dragged under the top header bar in landscape mode, where it gets hidden.

### What will change
- In `src/components/chrome/StatsChip.tsx`:
  - Measure the live height of the top chrome (header + optional floor selector) and use that as the minimum top boundary instead of the hardcoded `44`/`4` px values.
  - Keep the existing drag behavior exactly as-is: tap anywhere on the pill to drag, tap High/Low to highlight that point.
  - On window resize or orientation change, re-clamp the saved position so it cannot sit under the top bar after rotating from portrait to landscape.
  - Default initial position will sit just below the measured chrome, centered horizontally.
- No other components touched. Data model, Field/Topo behavior, and the diagnostic panel remain unchanged.

### Verification
- Open the Topo tab in landscape preview, drag the pill to the top, rotate back to portrait, and confirm it remains visible and draggable.
- Confirm the pill can still be dragged anywhere else on the canvas without restriction.