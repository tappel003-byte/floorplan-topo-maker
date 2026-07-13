## Topo legend: default 1.5× and persist position

**Behavior**
- Default scale on first open: `1.5×` (instead of `1×`).
- Legend position and scale persist across app restarts / project reopens via `localStorage`.
- Once moved, the legend stays put until moved again — no auto-reset when toggling Topo, switching floors, or reloading.

**Technical**
- In `TopoTab.tsx`, replace the in-memory `useState` for legend `scale` and `position` with a `localStorage`-backed hook (key: `topo.legend.v1` → `{ scale, x, y }`).
- Initial state: read from storage; if missing, use `{ scale: 1.5, x: <current default>, y: <current default> }`.
- Write on every change (drag end + slider change), debounced or on commit.
- SSR-safe read (guard `typeof window`), no other files touched.

Scope: `src/components/tabs/TopoTab.tsx` only.