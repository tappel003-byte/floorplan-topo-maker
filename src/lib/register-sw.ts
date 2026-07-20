// Guarded service worker registration. The service worker caches the app
// shell (HTML, JS, CSS) so the app can cold-start with no network.
//
// Rules enforced here:
// - Never register in dev, in Lovable preview, inside an iframe, or when
//   the URL has ?sw=off (kill switch). In any refused context, actively
//   unregister any existing /sw.js so preview builds never serve stale
//   cached content.
// - Registration path is /sw.js (matches vite-plugin-pwa filename).
// - When a new worker is waiting, notify subscribers so UI can prompt the user.

const APP_SW_URL = "/sw.js";

type WaitingListener = (waiting: ServiceWorker) => void;
const waitingListeners = new Set<WaitingListener>();
let currentWaiting: ServiceWorker | null = null;

export function onWaitingWorker(listener: WaitingListener): () => void {
  waitingListeners.add(listener);
  if (currentWaiting) listener(currentWaiting);
  return () => {
    waitingListeners.delete(listener);
  };
}

function notifyWaiting(worker: ServiceWorker) {
  currentWaiting = worker;
  waitingListeners.forEach((l) => {
    try {
      l(worker);
    } catch {
      // ignore
    }
  });
}

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

function trackUpdates(registration: ServiceWorkerRegistration) {
  // Already-waiting worker (installed before this page loaded).
  if (registration.waiting && navigator.serviceWorker.controller) {
    notifyWaiting(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (
        installing.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        notifyWaiting(installing);
      }
    });
  });
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const swParam = new URLSearchParams(window.location.search).get("sw");

  if (swParam === "off") {
    void unregisterAppServiceWorkers();
    return;
  }

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
        trackUpdates(registration);
      })
      .catch(() => {
        // Registration failed — nothing to do; app still works online.
      });
  };

  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
