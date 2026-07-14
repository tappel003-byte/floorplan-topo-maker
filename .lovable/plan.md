## Change

Keep the existing Setup tabs (Details / Plan & floors / Boundary). Add a persistent **"Start surveying →"** button so the user doesn't have to back out of Setup and re-tap the project to begin.

## Placement

A single button pinned to the bottom-right of the Setup panel (sticky footer inside the Setup tab container, above the floating bottom nav). Visible on all three sub-tabs so it's reachable whenever the user decides they're done configuring — not gated behind reaching the last tab.

- Label: **Start surveying →**
- Style: primary button
- Disabled state: only if the active floor has no plan image uploaded (with a small helper text "Upload a plan first"). Boundary is optional.

## Behavior

Tapping it switches the app's active tab from `setup` to `field` (the same tab state used by the bottom nav in `src/routes/projects.$id.tsx`). No navigation, no reload — just a tab change, so scroll/zoom state on the plan is preserved.

## Files

- `src/components/tabs/SetupTab.tsx` — add sticky footer with the button; accept an `onStartSurveying` callback prop.
- `src/routes/projects.$id.tsx` — pass `onStartSurveying={() => setTab("field")}` (or whatever the local state setter is named) into `<SetupTab />`.

No changes to the tab structure itself, the top bar, or any other screen.
