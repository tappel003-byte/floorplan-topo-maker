# Project Bundle Export / Import

Goal: move a whole project between devices as a single file. No cloud, no accounts, no sync logic. Export on one device, AirDrop/email/Drive the file, import on another.

## What gets exported

A single `.floorsurvey.json` file containing:
- Project metadata (name, address, inspector, date)
- All floors (name, boundary, plan image as base64 data URL, transitions, group averages)
- All points for every floor (coords, values, labels, notes, base-point flags, chain links)
- Render settings (palette, contour step, label font size, etc.)
- `bundleVersion` for forward compatibility
- `exportedAt` timestamp (informational)

Filename: `ProjectName_YYYY-MM-DD.floorsurvey.json`

## Where the buttons live

- **Project list screen only** (`ProjectList.tsx`) — there is no open project during import, so the workspace toolbar isn't the right place.
- Header: **Import project** button opens a file picker for `.floorsurvey.json`.
- Per-project row: **Export** action (overflow menu) writes the bundle via the browser download flow.

## Import behavior — auto-versioning

Every import creates a **new, fully independent project**. Original is never touched.

- Fresh project ID, fresh floor IDs, fresh point IDs. All internal references (point→floor, transition anchors→points, chain parentIds) are rewritten to the new IDs in one pass before any DB writes.
- Name gets an auto-incrementing version suffix based on what's already on the device:
  - No existing project with that base name → import keeps the original name.
  - "Smith House" exists → import becomes "Smith House V2".
  - "Smith House" and "Smith House V2" exist → import becomes "Smith House V3". And so on.
  - Base name is detected by stripping a trailing ` V<number>` before comparing, so re-importing a file already named "Smith House V2" from another device still lands as the next free V-number here.

Result: nothing is ever silently overwritten, and the device keeps a clean history you can compare or prune manually.

## Error handling

- Wrong file type or malformed JSON → toast: "That doesn't look like a Floor Survey bundle."
- `bundleVersion` newer than the app supports → toast: "This bundle was made with a newer version. Update the app to import it."
- Empty/partial bundle → refuse, no partial writes.

## Not in scope for this step

- Desktop-only "report polish / presentation" screen — noted, comes next once bundles work.
- Merging edits across devices, conflict resolution, auto-sync — explicitly out.
- Google Drive / iCloud integration — out.
- Multi-project bundle (one file, many projects) — out; one project per file.

## Technical notes

- New `src/lib/bundle.ts` with `exportProject(projectId): Promise<Blob>` and `importProject(file: File): Promise<string>` (returns new project ID). ID rewriting and name-versioning happen here before touching IndexedDB.
- Reuse existing `src/lib/db.ts` read/write functions; no schema changes.
- Plan image travels as the existing `planDataUrl` base64 already stored in IndexedDB, so bundles are self-contained. A typical bundle is a few MB — fine for AirDrop/email/Drive.
- Two small UI additions in `ProjectList.tsx`: header "Import" button and a per-row overflow menu with "Export".
