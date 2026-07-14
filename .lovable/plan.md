## Goal

Move a project between devices (phone → laptop or vice versa) by exporting a single `.json` file and importing it on the other device. No account, no cloud, no sync. Same app on both ends.

## Scope (this pass)

- Export **one project** as a `.json` file containing everything needed to reopen it: project meta, all floors (including plan image), all points, all transitions/notes stored on those records.
- Import a `.json` file on any device — always creates a **new project** with fresh IDs. No overwriting, no dialog.
- Reuse the existing UI on desktop. No new edit surface, no layout changes.

## UX

**Project list (`ProjectList.tsx`) — header:**
- Add an `Import` button next to `New project`. Opens a hidden `<input type="file" accept="application/json">`. On file pick: parse, validate, write, refresh list, navigate into the new project.

**Project list — each row:**
- Add a small `Download` icon button (next to the existing trash icon). Tapping it exports that project as `{sanitized-name}-{yyyy-mm-dd}.json`.

That's it. No changes to Setup/Field/Data/Topo/Review.

## File format

Single JSON, versioned so we can evolve it:

```json
{
  "app": "floor-survey",
  "version": 1,
  "exportedAt": 1720000000000,
  "project": { /* ProjectMeta, id preserved for reference only */ },
  "floors": [ /* Floor[] — includes boundary and plan image (already base64/dataURL in DB) */ ],
  "points": [ /* SurveyPoint[] across all floors */ ]
}
```

Plan images already live inside the `Floor` record (dataURL), so no separate binary handling is needed — they ride along in the JSON.

## Import behavior

- Validate `app === "floor-survey"` and `version === 1`. Reject anything else with a clean error toast.
- Mint a **new** `projectId` and new `floorId`s / `pointId`s. Rewrite all foreign keys (`point.floorId`, `floor.projectId`, and any `transitionId` / `parentId` / `anchorId` references inside points) using an old→new ID map so chained transitions survive.
- Append `" (imported)"` to the project name so duplicates are obvious in the list.
- Set `createdAt = updatedAt = Date.now()` on the new project.
- Navigate into the new project on success.

## Technical notes

- New file `src/lib/projectIO.ts` with `exportProject(projectId): Promise<Blob>` and `importProjectFromFile(file): Promise<string /* newProjectId */>`. Uses existing `db.ts` helpers.
- Trigger download with an anchor + `URL.createObjectURL` — no extra deps.
- Import button uses a hidden file input triggered by a ref; no drag-drop for now.
- Keep validation lenient on unknown fields (forward-compat) but strict on required shapes.

## Out of scope (explicitly)

- No cloud sync, no Google Drive, no accounts.
- No collision detection / merge — every import is a new project.
- No bulk export of multiple projects at once.
- No CSV/PDF changes — those exports already exist elsewhere and stay as-is.
- No desktop-only UI. Same responsive app.

## Follow-ups we can add later if you want

- "Replace existing" option when IDs collide (round-trip use case).
- Drag-and-drop a `.json` onto the project list.
- Zip bundle if plan images ever get too big for JSON.
