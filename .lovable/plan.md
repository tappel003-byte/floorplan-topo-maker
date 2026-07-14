Misread the last request. You want:

1. **Revert the stats chip** back to just `↑10.20  ↓8.20  Δ2.00` — remove the A−, A+, and ⋯ buttons entirely.
2. **Make the "High" / "Low" pin labels on the plan resizable** — the red/blue pills that mark the high and low points on the canvas (image 1). Right now they're a fixed size and don't scale with the plan.

**For the pin label resizing**, my proposal:
- Reuse the existing "Shared label font size" slider (the one that already scales point value labels and topo labels). The High/Low pin pills read the same size setting, so all on-plan text scales together.
- No new UI. One slider, everything on the plan scales in unison.

Files touched:
- `src/components/chrome/StatsChip.tsx` — remove the A−/A+/⋯ additions.
- Wherever the High/Low pin markers render on the canvas (likely `PlanCanvas.tsx` or `FieldTab.tsx` — will confirm on the build) — wire pill font/padding to the shared label size.

Sound right?