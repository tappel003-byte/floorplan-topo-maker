## Goal
Make the floating High / Low / Δ pill (StatsChip) scale sensibly across phone, tablet, and desktop instead of a fixed 24px tall / 10px-text chip.

## Approach
Add a responsive size system to `src/components/chrome/StatsChip.tsx`:

1. **Auto-scale by viewport width** (three tiers, picked on mount + resize):
   - Phone (<768px): current size (h-6, text-[10px], icons 2.5)
   - Tablet (768–1279px): h-8, text-xs, icons 3
   - Desktop (≥1280px): h-10, text-sm, icons 3.5
2. **User override**: small `−` / `+` buttons or a 0.75×–1.75× multiplier stored in localStorage (`stats-chip-scale`), so the user can nudge it on any device.
3. Recompute chip width/height clamp on resize so the persisted position stays on-screen after the size changes.

Nothing else changes — position, drag, tap-to-highlight, and persistence all stay as-is.

## Open question
Do you want the size to be **fully automatic** by screen size (simplest, no controls), or **automatic with a small +/− nudge** the user can override? I'd default to fully automatic unless you want the manual nudge.