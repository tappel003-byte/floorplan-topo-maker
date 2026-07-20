// Guarded service worker registration. The service worker caches the app
// shell (HTML, JS, CSS) so the app can cold-start with no network.
//
// Data-safety boundary: setOfflineMode("off") only touches Cache Storage
// entries owned by this app's SW (html-navigations, app-shell-assets,
// workbox-*). It NEVER touches localStorage (beyond the offlineMode
// flag), sessionStorage, IndexedDB (where project data lives via
// src/lib/db.ts), or cookies. No indexedDB.deleteDatabase, no unfiltered
// caches.delete(), no navigator.storage.clear() — ever.

const APP_SW_URL = "/sw.js";
const OFFLINE_MODE_KEY = "offlineMode";
const APP_CACHE_NAMES = new Set(["html-navigations", "app-shell-assets"]);

type WaitingListener = (waiting: ServiceWorker) => void;
const waitingListeners = new Set<WaitingListener>();
let currentWaiting: ServiceWorker | null = null;
let lastUpdateCheck = 0;

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
        const scriptURL =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          "";
        if (scriptURL.endsWith(APP_SW_URL)) {
          await registration.unregister();
        }
      }),
    );
  } catch {
    // Best-effort cleanup.
  }
}

// Delete ONLY this app's SW caches. Never a blanket caches.delete().
async function clearAppShellCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => APP_CACHE_NAMES.has(name) || name.startsWith("workbox-"))
        .map((name) => caches.delete(name)),
    );
  } catch {
    // ignore
  }
}

export function getOfflineMode(): "on" | "off" {
  if (typeof window === "undefined") return "on";
  try {
    const v = window.localStorage.getItem(OFFLINE_MODE_KEY);
    return v === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

// Off = force-fetch latest code now. Clears Cache Storage entries owned
// by this app's SW only, then reloads. Auto-flips back to "on" after
// reload so the user stays protected for the next field trip.
export async function setOfflineMode(next: "on" | "off"): Promise<void> {
  if (typeof window === "undefined") return;
  if (next === "on") {
    try {
      window.localStorage.setItem(OFFLINE_MODE_KEY, "on");
    } catch {
      // ignore
    }
    registerServiceWorker();
    return;
  }

  // "off" branch — the ONLY place we clear caches. Boundary:
  //   1) unregister /sw.js
  //   2) delete Cache Storage entries (app-shell only, name-filtered)
  //   3) reload
  // Never touches IndexedDB / localStorage (except the flag) / cookies.
  try {
    window.localStorage.setItem(OFFLINE_MODE_KEY, "on"); // self-heal after reload
  } catch {
    // ignore
  }
  await unregisterAppServiceWorkers();
  await clearAppShellCaches();
  window.location.reload();
}

function checkForUpdate(registration: ServiceWorkerRegistration) {
  const now = Date.now();
  if (now - lastUpdateCheck < 10_000) return;
  lastUpdateCheck = now;

  registration.update().catch(() => {
    // Best-effort — offline or transient failures are fine.
  });
}

function trackUpdates(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    notifyWaiting(registration.waiting);
  }
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        notifyWaiting(installing);
      }
    });
  });
}

// Deferred reload: never reload while the app is visible. Wait until the
// user backgrounds it (visibilitychange -> hidden) or returns from bfcache
// (pageshow). This avoids yanking the page mid-input.
let reloadedForUpdate = false;
let reloadPending = false;

function performReload() {
  if (reloadedForUpdate) return;
  reloadedForUpdate = true;
  window.location.reload();
}

function schedulePendingReload() {
  if (reloadPending) return;
  reloadPending = true;

  const tryReload = () => {
    if (document.visibilityState === "hidden") {
      performReload();
    }
  };

  document.addEventListener("visibilitychange", tryReload);
  window.addEventListener("pageshow", (e) => {
    // Reload on bfcache restore — user just came back, page will feel fresh.
    if ((e as PageTransitionEvent).persisted) performReload();
  });
}

function setupControllerReload() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    if (document.visibilityState === "hidden") {
      performReload();
    } else {
      schedulePendingReload();
    }
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

  // Self-heal: if user toggled Off in a previous session, flip back to On.
  try {
    if (window.localStorage.getItem(OFFLINE_MODE_KEY) !== "on") {
      window.localStorage.setItem(OFFLINE_MODE_KEY, "on");
    }
  } catch {
    // ignore
  }

  const doRegister = () => {
    setupControllerReload();
    navigator.serviceWorker
      .register(APP_SW_URL)
      .then((registration) => {
        trackUpdates(registration);
        checkForUpdate(registration);

        window.addEventListener("pageshow", () => checkForUpdate(registration));
        window.addEventListener("focus", () => checkForUpdate(registration));
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate(registration);
        });
      })
      .catch(() => {
        // Registration failed — app still works online.
      });
  };

  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
