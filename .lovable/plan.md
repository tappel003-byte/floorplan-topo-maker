## Goal

Match the Distress Survey pattern: deleting a project from the home screen moves it to a Trash bin instead of erasing it. A separate "empty trash" step is what actually deletes. So a stray tap can't lose a project.

## Behavior

**Project row overflow menu**
- "Delete" is replaced with **"Move to trash"** (still one confirm, but low-stakes wording: "Move to trash? You can restore it later.").
- Export stays as-is.

**Home screen (project list)**
- A **Trash** button appears in the header next to Import, with a small count badge when non-empty. Hidden or disabled when trash is empty.
- Trashed projects do not appear in the main list.

**Trash screen** (opens as a dialog / sheet from the header button)
- Lists trashed projects with name, address, date trashed.
- Each row: **Restore** and **Delete forever** (Delete forever asks a hard confirm: "Permanently delete 'Smith House'? This cannot be undone.").
- Footer button: **Empty trash** — hard confirm ("Permanently delete all N projects in trash?"), then wipes them all.
- No auto-purge timer — items stay until the user empties trash. (Distress Survey uses 30 days; skipping that keeps this simple, and it's what you actually asked for. Say the word if you want auto-purge.)

**Restore behavior**
- Restore puts the project back in the main list untouched (same id, same data). No V2 renaming — this isn't an import.

## Data model

`ProjectMeta` gains an optional `deletedAt?: number` field.
- `listProjects()` filters out rows with `deletedAt` set.
- New `listTrashedProjects()` returns only rows with `deletedAt` set, newest-first.
- New `trashProject(id)` sets `deletedAt = Date.now()` and saves.
- New `restoreProject(id)` clears `deletedAt` and saves.
- Existing `deleteProject(id)` (hard delete + cascades floors/points) is what "Delete forever" and "Empty trash" call.

No IndexedDB schema bump needed — `deletedAt` is just an optional property on existing project records.

## Files touched

- `src/lib/types.ts` — add `deletedAt?: number` to `ProjectMeta`.
- `src/lib/db.ts` — filter `listProjects`, add `listTrashedProjects`, `trashProject`, `restoreProject`.
- `src/components/ProjectList.tsx` — rename menu item, add Trash header button + badge, add Trash dialog with Restore / Delete forever / Empty trash.

Nothing else changes. Export/import, setup flow, and everything inside a project are untouched.

## Open question

One thing I want to confirm before building: **should the Trash button be visible when empty (disabled/greyed) or hidden entirely until something is in it?** Distress Survey shows a dimmed FAB always. Your call — I'll default to "hidden until non-empty" unless you say otherwise.
