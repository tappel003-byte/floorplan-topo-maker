The A−/A+ buttons already exist but are hidden behind a 500ms long-press on the chip — with no visible hint, you'd never know they're there.

**Fix:** Make the size controls discoverable.

- Add a small chevron/handle segment at the right end of the chip (always visible, ~10px wide, subtle gray "···" or "⋯").
- Tap that handle to toggle the A−/A+ buttons inline (same behavior as today's long-press, just discoverable).
- Long-press still works as a shortcut for anyone who finds it.
- Nudge value continues to persist in localStorage and stacks on top of the auto responsive base tier (xs → xl, ±2 range).

Only `src/components/chrome/StatsChip.tsx` changes. No logic changes to High/Low/Delta or drag behavior.