import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { getOfflineMode, setOfflineMode } from "@/lib/register-sw";

export function OfflineModeToggle() {
  const [mounted, setMounted] = useState(false);
  const [on, setOn] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOn(getOfflineMode() === "on");
  }, []);

  if (!mounted) return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  async function handleChange(next: boolean) {
    if (busy) return;
    setBusy(true);
    setOn(next);
    // "off" reloads the page. "on" registers the SW.
    await setOfflineMode(next ? "on" : "off");
    setBusy(false);
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-1">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={on} onCheckedChange={handleChange} disabled={busy} />
        <span className="font-medium text-foreground">Offline mode</span>
      </label>
      <p className="text-[11px] text-muted-foreground max-w-[260px] text-center leading-tight">
        {on
          ? "On — works with no signal. Flip off to grab the latest update."
          : "Off — fetching latest version…"}
      </p>
    </div>
  );
}
