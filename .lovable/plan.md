The user selected option B: replace the ↑ / ↓ arrows in the floating elevation stats pill with explicit H and L labels.

## Change
Update `src/components/chrome/StatsChip.tsx`:
- Remove the `ArrowUp` and `ArrowDown` imports from `lucide-react`.
- Replace the arrow icon in the high-value segment with the letter "H" (keep emerald-600 color).
- Replace the arrow icon in the low-value segment with the letter "L" (keep sky-600 color).
- Keep the numeric values, delta, layout, drag behavior, and tap-to-highlight behavior unchanged.

## Result
Header pill reads: `H 10.20 | L 8.20 | Δ 2.00` instead of `↑ 10.20 | ↓ 8.20 | Δ 2.00`.