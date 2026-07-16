
# Cleanup screen

A new full-screen view opened from the ⋯ menu in the top bar, alongside Review / Setup / Transitions / Export. Its job is **manipulating the underlying data** — as opposed to Topo, which *presents* it, and Data, which *enters* it.

Available on every project (not gated to V2 duplicates).

## Entry point

Add "Cleanup" to the ⋯ menu in `AppTopBar.tsx`, above Export. Opens a new route/hash view over the project shell — same pattern Align mode uses today.

## What lives inside

Phase 1 — move the existing pieces in first, no new behavior:

- **Move points** — the multi-select + group-drag interaction we already built for Align mode, lifted out and made the default tool of the Cleanup tab. Single-tap still drags one point.
- **Replace plan image + Align** — the current AlignPlanMode UI (image translate / scale / rotate, upload new raster). No longer V2-gated.
- **Transitions** — the current `TransitionsSheet` embedded as a panel here. Editing transitions is a "sit down and think" task, not a field task.
- **Review** — the sortable table (`ReviewTab`) embedded as a panel here. Same reasoning: it's the desk view of the data.

Phase 2 (later, not this build): bulk edits, rectangle marquee, keyboard nudge, snap-to-grid. Called out so we know where they land.

## What stays where it is

- **Data panel** on the Field screen — unchanged. Still the primary entry surface on the phone.
- **Topo tab** — unchanged. Its dropdown toolbox keeps all presentation controls (palettes, label mode, high/low sizes, legend, contours). Cleanup does not duplicate any of them.
- **Setup / Export** — stay in the ⋯ menu as separate items. Setup is boundary definition, Export is output — neither is data manipulation.

## Menu after this change

⋯ menu:
- Review → *(now opens inside Cleanup)*
- Setup
- Transitions → *(now opens inside Cleanup)*
- **Cleanup** *(new)*
- Export

Open question for the build phase: whether Review and Transitions get their own menu items *and* live inside Cleanup, or whether the menu items go away and Cleanup becomes the sole entry point. My default is to keep the shortcuts and also surface them inside Cleanup — least disruptive, and the ⋯ menu is cheap.

## Files touched

- `src/components/chrome/AppTopBar.tsx` — add "Cleanup" menu item and `onOpenCleanup` prop.
- `src/routes/projects.$id.tsx` — wire a `#cleanup` hash view that renders the new screen, same pattern as `#align`.
- `src/components/CleanupScreen.tsx` *(new)* — layout with sub-tabs / panels for Move points, Plan align, Transitions, Review.
- `src/components/AlignPlanMode.tsx` — extract the image-align controls and the multi-select point tools so `CleanupScreen` can host them without duplicating logic. Existing `#align` entry point keeps working during transition.
- No changes to `TopoTab.tsx`, `DataPointsPanel.tsx`, `FieldTab.tsx`, or `PlanCanvas.tsx` core behavior.

## Acceptance

- ⋯ menu shows a "Cleanup" item on every project (V1 and V2).
- Selecting it opens a full-screen view over the project with sub-panels for Move points, Plan align, Transitions, Review.
- Move points inside Cleanup behaves exactly like today's Align → Move points: tap Select, tap points to toggle, drag any selected point to move the group.
- Replace plan image works from Cleanup on any project, not just duplicates.
- Field / Data / Topo screens are visibly unchanged.
- Done commits, Cancel discards, same as Align does today.
