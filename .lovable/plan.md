## Problem

Creating a project drops you straight into the Field view because `projects.$id.tsx` initializes `mode` to `"field"`. The Setup tabs (Details / Plan & floors / Boundary) are only reachable if you tap the Setup shortcut in the top bar, so a new project appears to skip setup entirely.

## Fix

Two small changes, both in existing files. No new components.

### 1. Land new projects on Setup

In `src/routes/projects.$id.tsx`:

- When the loaded project has no plan on any floor (i.e. it's brand new), open in `mode = "setup"` instead of `"field"`.
- Existing projects with a plan continue to open on Field.

Rule: after `listFloors`, if no floor has a `planDataUrl`, set `mode` to `"setup"`.

### 2. Guide the user through Setup in order

In `src/components/tabs/SetupTab.tsx`, keep the three tabs but make the flow feel like steps 1 → 2 → 3 without removing the ability to jump around:

- Rename tab labels to numbered steps: **1. Details**, **2. Plan**, **3. Boundary**.
- Replace the single sticky **Start surveying →** button with a context-aware sticky footer:
  - On **Details**: **Next: Plan →** (always enabled).
  - On **Plan**: **Next: Boundary →** (enabled once a plan is uploaded; helper text "Upload a plan first" when disabled). A secondary **Back** link on the left.
  - On **Boundary**: **Start surveying →** (enabled once a plan is uploaded; boundary remains optional). **Back** on the left.
- Tapping Next just changes the internal `tab` state — no navigation.
- Tab bar remains clickable for jumping directly to any step.

## Files touched

- `src/routes/projects.$id.tsx` — initial `mode` depends on whether any floor has a plan.
- `src/components/tabs/SetupTab.tsx` — relabel tabs, replace footer with Back / Next → / Start surveying → depending on step.

## Not changing

Setup tab internals, top-bar Setup shortcut, home screen, Field / Topo / Review / Export.
