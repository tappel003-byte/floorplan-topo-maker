Change the Data panel's default initial state so that it opens collapsed to just the header bar instead of expanded. If there is no saved panel state for the project, it will start collapsed.

## What to change
- `src/components/DataPointsPanel.tsx`: Update the `loadState` fallback so the initial `collapsed` value is `true` instead of `false`.

## Outcome
When the field view opens and the Data panel has no saved state, it will appear as a small header bar (still draggable and can be expanded/hidden) rather than opening fully expanded.