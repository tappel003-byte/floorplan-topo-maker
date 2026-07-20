## Why the earlier steps didn't work

On iOS, a home-screen PWA and Safari are separate storage sandboxes. They don't share service workers or caches. Opening `?sw=off` in Safari only cleared Safari's copy — your home-screen icon still had its own untouched old service worker, so it kept serving the old cached shell.

The fix is a one-time reset **inside the home-screen sandbox**, plus a permanent way to force an update from inside the app so this never traps you again.

## Plan

### 1. One-time reset on your phone (no code change)

- Long-press the "Floor Survey" icon on your home screen → Delete / Remove App.
- Open Safari, go to `https://floorplan-topo-maker.lovable.app/`.
- Tap Share → Add to Home Screen. Re-add it.
- Open the new home-screen icon. It'll install the current published build (with the foreground-check behavior baked in) fresh, from scratch.

From this point forward, every time I publish a change and you reopen the icon, it'll check in the background and the "Update available — tap to refresh" banner will appear.

### 2. Add a permanent "Check for updates" button (code change)

So you're never stuck like this again — even if iOS gets stubborn — add a small manual escape hatch inside the app itself.

- Add a "Check for updates" button on the landing screen (in `ProjectList.tsx`), probably tucked in a corner or under a small menu so it doesn't clutter the UI.
- When tapped, it calls `registration.update()` on the active service worker. If a new version exists, the existing update banner appears at the top and you tap it to refresh. If nothing new exists, show a brief "You're up to date" confirmation.
- This means: no more relying on iOS to decide when to check. If you ever suspect the app is stale, one tap forces the check from inside the home-screen sandbox itself.

### Technical details

- The button uses the same `navigator.serviceWorker.getRegistration()` → `registration.update()` path the automatic foreground check uses. No new SW logic, no new caching behavior.
- If no service worker is registered (e.g. you're inside Safari on a Lovable preview URL where SW is refused), the button is hidden.
- No changes to `sw.ts`, `vite.config.ts`, or the update banner. Purely additive UI + a small wrapper around `registration.update()`.

### What this does NOT change

- The service worker itself, caching rules, offline behavior — all untouched.
- The "Floor Survey" heading color — untouched.
- The existing update banner — untouched. The button just triggers the same check the banner already listens for.
