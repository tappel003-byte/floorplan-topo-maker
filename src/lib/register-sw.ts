// Guarded service worker registration. The service worker caches the app
// shell (HTML, JS, CSS) so the app can cold-start with no network.
//
// Rules enforced here:
// - Never register in dev, in Lovable preview, inside an iframe, or when
//   the URL has ?sw=off (kill switch). In any refused context, actively
//   unregister any existing /sw.js so preview builds never serve stale
//   cached content.
// - Registration path is /sw.js (matches vite-plugin-pwa filename).

const APP_SW_URL = "/sw.js";

function hostnameMatchesPreview(hostname: string): boolean {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) {
    return true;
  }
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) {
    return true;
  }
  if (
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com")
  ) {
    return true;
  }
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) {
    return true;
  }
  return false;
}

async function unregisterAppServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (registration) => {
        const scriptURL = registration.active?.scriptURL ?? "";
        if (scriptURL.endsWith(APP_SW_URL)) {
          await registration.unregister();
        }
      }),
    );
  } catch {
    // Ignore — best-effort cleanup.
  }
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const swParam = new URLSearchParams(window.location.search).get("sw");

  // ?sw=off is an unconditional kill switch.
  if (swParam === "off") {
    void unregisterAppServiceWorkers();
    return;
  }

  // ?sw=on forces registration even in normally-refused contexts
  // (preview hosts, iframes, non-prod). Use with care.
  const forceOn = swParam === "on";

  const shouldRefuse =
    !forceOn &&
    (!import.meta.env.PROD ||
      window.self !== window.top ||
      hostnameMatchesPreview(window.location.hostname));

  if (shouldRefuse) {
    void unregisterAppServiceWorkers();
    return;
  }

  const doRegister = () => {
    navigator.serviceWorker
      .register(APP_SW_URL)
      .then((registration) => {
        // iOS home-screen apps often resume from bfcache instead of reloading.
        // Check for a new service worker when the page is restored this way.
        window.addEventListener("pageshow", (event) => {
          if (event.persisted) {
            void registration.update();
          }
        });

        // Also check for updates whenever the app is brought back to the
        // foreground after being backgrounded.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void registration.update();
          }
        });

        // When skipWaiting + clientsClaim installs a new worker, reload once
        // so the user gets the fresh version without a manual refresh.
        let hasReloaded = false;
        navigator.serviceWorker.oncontrollerchange = () => {
          if (!hasReloaded) {
            hasReloaded = true;
            window.location.reload();
          }
        };
      })
      .catch(() => {
        // Registration failed — nothing to do; app still works online.
      });
  };

  // `useEffect` typically runs after `load` has already fired, so attaching
  // a `load` listener would never trigger. Register immediately if the
  // document has already loaded; otherwise wait for the event.
  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
