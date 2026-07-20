Multi-user updates, offline, data-safety boundary on the toggle, and a mid-entry safeguard on the auto-reload.

## Silent auto-update (the real update path)

Offline mode stays **On by default**. The service worker pulls in new versions in the background whenever a user opens the app with signal — no banners, no buttons, no instructions to teammates.

1. Open the home-screen app.
2. With signal, it quietly checks for a newer version.
3. If found, it downloads and takes over.
4. The app reloads to the new version **only when it's safe** (see below).
5. No signal → nothing happens; cached app runs normally.

## MID-ENTRY SAFEGUARD — when the reload actually fires

When a new service worker takes over (`controllerchange`), the reload is **deferred, not immediate**. It fires only when the app is not actively in use:

- If `document.visibilityState === "hidden"` at that moment → reload now (user isn't looking).
- Otherwise → set a flag and wait. Reload happens on the **next** `visibilitychange → hidden` OR `pageshow` after a background return.
- Result: nobody ever sees a reload mid-keypress or mid-form. The update lands the next time they background/reopen the app, which on iOS home-screen usage happens constantly.

This is stronger than a "dirty form" check because it doesn't depend on every form correctly tracking unsaved state — it just never reloads while the user is present.

## Offline mode toggle (rare safety net)

Landing screen switch, **On by default**. Invisible to 99% of users.

- Off: force-fetch newest code right now.
- On: normal state.

## DATA SAFETY — WHAT "OFF" TOUCHES

The Off action does exactly these three things, in this order:
1. `registration.unregister()` on `/sw.js`.
2. Delete entries from the **Cache Storage API only**, filtered by name to this app's SW caches (`html-navigations`, `app-shell-assets`, `workbox-*` scoped to this registration).
3. Reload the page.

Will **NOT** touch, under any circumstances:
- `localStorage` (beyond writing the `offlineMode` flag).
- `sessionStorage`.
- **IndexedDB** — all project data lives here (`src/lib/db.ts` via `idb`). Untouched.
- Cookies.
- Any other origin storage.

No `indexedDB.deleteDatabase`. No unfiltered `caches.delete()`. No `navigator.storage.clear()`. If a future edit tries to add any of those, it's a bug — call it out.

## Technical changes

- `src/sw.ts`:
  - On install: `self.skipWaiting()`.
  - On activate: `self.clients.claim()`.
- `src/lib/register-sw.ts`:
  - Default `offlineMode` → `"on"`, self-heal to `"on"` after an Off cycle.
  - Keep `registration.update()` on `pageshow` / `visibilitychange` / `focus`.
  - **Change `controllerchange` handler**: if `document.visibilityState === "hidden"` reload immediately; else set `pendingReload = true` and attach listeners for `visibilitychange` (fire when hidden) and `pageshow` (fire on return from bfcache). Reload at most once.
  - Add `setOfflineMode("off")` implementing the three-step boundary above.
- New `src/components/OfflineModeToggle.tsx`: shadcn Switch + one-line hint.
- `src/components/ProjectList.tsx`: replace `<CheckForUpdatesButton />` with `<OfflineModeToggle />`.
- Preview/dev guards and `?sw=off` unchanged.
- `UpdateBanner`: file kept, unmounted from `__root.tsx`.

## Migration

One-time: open the home-screen app once with signal so the new self-updating worker installs. After that, every publish reaches everyone automatically on their next backgrounded/reopened session.