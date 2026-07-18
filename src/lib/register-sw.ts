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

  const shouldRefuse =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    hostnameMatchesPreview(window.location.hostname) ||
    new URLSearchParams(window.location.search).has("sw") &&
      new URLSearchParams(window.location.search).get("sw") === "off";

  if (shouldRefuse) {
    void unregisterAppServiceWorkers();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(APP_SW_URL).catch(() => {
      // Registration failed — nothing to do; app still works online.
    });
  });
}
