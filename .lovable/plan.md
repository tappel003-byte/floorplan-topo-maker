Goal: keep offline mode, but make the iPhone home-screen app update without deleting/re-adding the shortcut.

Plan:

1. Keep the offline service worker and cached app shell.
   - Do not remove offline mode.
   - Keep `/sw.js` and the current Workbox offline caching setup.

2. Fix the installed-app update path.
   - In `src/lib/register-sw.ts`, make the app check for updates at the times iOS home-screen apps actually resume:
     - after registration succeeds,
     - when the app becomes visible again,
     - on `pageshow`, not only when `event.persisted` is true,
     - on `focus`, as another iOS safety net.
   - Add light throttling so it does not spam update checks.

3. Auto-apply updates only when a new worker is actually waiting.
   - If `registration.waiting` exists, send `{ type: "SKIP_WAITING" }`.
   - If `updatefound` reaches `installed` and the page is already controlled, send `{ type: "SKIP_WAITING" }`.
   - Keep the existing one-time reload on `controllerchange`, so the user gets the new app after the new worker takes control.

4. Remove the banner dependency from the update flow.
   - The banner can stay in the code if already present, but the shortcut update should not depend on the user seeing or tapping it.
   - The installed app should update by closing/reopening or foregrounding with network.

5. Verify the build.
   - Confirm TypeScript/build passes after the change.

Important expectation:
- The currently installed shortcut may need to successfully receive this one fix first. After this update logic is installed once, future published changes should apply from the home-screen shortcut without deleting and re-adding it.