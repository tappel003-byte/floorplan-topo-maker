import { useEffect, useState } from "react";
import { getOfflineMode, setOfflineMode } from "@/lib/register-sw";

// Rare manual escape hatch — small text link, not a daily control.
// The app is offline-capable and auto-updates in the background whenever
// signal is available; users should almost never need this.
export function OfflineModeToggle() {
  const [mounted, setMounted] = useState(false);
  const [on, setOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [noSignal, setNoSignal] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOn(getOfflineMode() === "on");
  }, []);

  useEffect(() => {
    if (!noSignal) return;
    const t = setTimeout(() => setNoSignal(false), 3000);
    return () => clearTimeout(t);
  }, [noSignal]);

  if (!mounted) return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  async function hasConnectivity(): Promise<boolean> {
    if (!navigator.onLine) return false;
    try {
      await fetch("/", {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      return true;
    } catch {
      return false;
    }
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setNoSignal(false);

    if (!(await hasConnectivity())) {
      setNoSignal(true);
      setBusy(false);
      return;
    }

    // Toggle: if currently on, "off" clears app-shell cache & reloads to
    // pull the latest build; then user can flip it back on. Project data
    // in IndexedDB is never touched.
    const next = on ? "off" : "on";
    setOn(next === "on");
    await setOfflineMode(next);
    setBusy(false);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        title="Clears the cached app shell and reloads from the network. Does not touch project data."
      >
        {on ? "Force refresh app" : "Fetching latest…"}
      </button>
      {noSignal && (
        <p className="text-[11px] text-amber-600 mt-1" aria-live="polite">
          No signal — can’t refresh right now
        </p>
      )}
    </div>
  );
}
