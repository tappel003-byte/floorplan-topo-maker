## Fix: Review tab shows raw values instead of corrected

Same bug as the Data panel. `ReviewTab.tsx` reads `p.value` directly in five places, so a point with a 9.8−0.8 transition renders as 9.80 and sorts/stats on 9.80.

### Changes
1. **`src/components/tabs/ReviewTab.tsx`**
   - Accept a `correctedById: Map<string, number>` prop (same shape already passed to `DataPointsPanel`).
   - Add a `displayValue(p)` helper: `correctedById.get(p.id) ?? p.value`.
   - Route all five current `p.value` reads through it: stats calc (line 31), outlier detection (44), high/low sort (51–52), and the row cell (152).
2. **`src/routes/projects.$id.tsx`**
   - Pass the existing `correctedById` map into `<ReviewTab />` (already computed for the Data panel — no new computation).

### Risk check — anywhere else still on raw?
Ran a sweep for `p.value` / `.value` reads across components. Already corrected: Topo, StatsChip, Export, Data panel (last turn). Remaining raw-value site: **Review only**. `PointDetail` and `NumericKeypad` intentionally show raw because they're the editor for the underlying reading — that's correct, not a bug.

### Won't break
- No data model or persistence changes.
- Stats numbers on Review will shift to match Topo/Stats/Export — that's the intended alignment, not a regression.
- Sort order changes only for points that have a transition applied; unaffected points sort identically.
- Prop is additive with a safe fallback (`?? p.value`), so if the map is ever empty the tab renders exactly as today.