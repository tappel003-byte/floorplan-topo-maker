## What I confirmed

- Floor Survey routes are only `/` and `/projects/$id`, and both boot through `src/routes/__root.tsx`.
- The published Floor Survey site now does register `/sw.js` in desktop Chromium, but the offline failure can still happen because its navigation fallback is `/` while `/` is not listed in the precache manifest.
- The working Distress Survey app avoids that mismatch by falling back to a concrete precached HTML shell (`/survey.html`) and by registering the SW earlier from router bootstrap.

## Plan

1. **Move SW registration to router bootstrap**
   - Import and call the registration wrapper once in `src/router.tsx`, matching the working Distress Survey pattern.
   - Remove the `useEffect` registration from `src/routes/__root.tsx` so there is only one registration path.

2. **Make Floor’s offline HTML fallback actually precached**
   - Update the PWA Workbox config so the built HTML entry is included in the precache with a URL the browser can request offline.
   - Replace the current simple `modifyURLPrefix` setup with the same safer `manifestTransforms` style used in Distress Survey:
     - Strip `client/` from built client files.
     - Exclude `server/` bundle files.
     - Preserve built HTML/JS/CSS/icons/manifest.

3. **Keep the safety rules unchanged**
   - Keep `/sw.js`.
   - Keep `generateSW`.
   - Keep `injectRegister: null`.
   - Keep `devOptions.enabled: false`.
   - Keep preview/dev/iframe refusal.
   - Keep `?sw=off` and `?sw=on` behavior.
   - Do not touch IndexedDB, localStorage survey data, UI, components, or the data model.

4. **Verify after implementation**
   - Check the generated/live `/sw.js` manifest contains a real HTML fallback entry and valid asset URLs.
   - Check live `navigator.serviceWorker.getRegistrations()`, `navigator.serviceWorker.ready`, and `caches.keys()` again after publish.

## Expected result

After publishing and one online load, Safari should have a registered worker plus a precached HTML shell, so airplane-mode cold start can open the app shell instead of showing Safari’s “not connected to the internet” page.