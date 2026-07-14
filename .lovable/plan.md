Match the Distress Survey trash button exactly.

What Distress Survey actually renders (from its `survey.html`):
- A 56×56 fixed circular button in the bottom-right.
- 1px border in the app's line color.
- Paper/cream background.
- Box shadow: `0 4px 12px rgba(0,0,0,0.15)`.
- **The icon is the emoji `🗑` at 24px font-size** — not a Lucide SVG.
- Empty state: `opacity: 0.35`, not clickable.
- Non-empty: full opacity, small red badge with the count top-right.

Changes in Floor Survey (`src/components/ProjectList.tsx` only):

1. Replace the Lucide `<Trash2 />` inside the floating button with the literal emoji character `🗑` rendered at ~24px.
2. Set the button to 56×56, 1px border, cream background, `shadow-[0_4px_12px_rgba(0,0,0,0.15)]`, fixed bottom-right with safe-area padding.
3. Empty state uses `opacity-35`; non-empty state uses full opacity and shows the small red count badge (matching Distress Survey which does show a badge when non-empty).
4. Keep the current behavior: empty → toast "Trash is empty"; non-empty → open trash dialog.

No other files change. Behavior for delete/restore/permanent-delete is untouched.