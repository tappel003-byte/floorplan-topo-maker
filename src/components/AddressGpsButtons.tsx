import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onAddress: (addr: string) => void;
}

function getPos(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("GPS not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function geoError(e: unknown): string {
  const err = e as GeolocationPositionError & { message?: string };
  if (err && typeof err.code === "number") {
    if (err.code === 1) return "Location permission denied";
    if (err.code === 2) return "Location unavailable";
    if (err.code === 3) return "Location request timed out";
  }
  return err?.message || "Could not get location";
}

/** Address Auto-fill only — GPS coordinates live on Set Base Point. */
export function AddressGpsButtons({ onAddress }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fillAddress() {
    setBusy(true);
    setMsg(null);
    try {
      const pos = await getPos();
      const { latitude, longitude } = pos.coords;
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
        const data = await res.json();
        const a = data?.address ?? {};
        const house = a.house_number || "";
        const road = a.road || a.pedestrian || a.footway || "";
        const city = a.city || a.town || a.village || a.hamlet || a.suburb || "";
        const state = a.state || "";
        const parts: string[] = [];
        const line1 = [house, road].filter(Boolean).join(" ").trim();
        if (line1) parts.push(line1);
        if (city) parts.push(city);
        if (state) parts.push(state);
        const display =
          parts.length > 0
            ? parts.join(", ")
            : (data?.display_name as string | undefined) ||
              `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        onAddress(display);
        setMsg(null);
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      try {
        const pos = await getPos();
        const { latitude, longitude } = pos.coords;
        onAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setMsg("Address lookup failed — filled coordinates instead");
      } catch {
        setMsg(geoError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full h-9 justify-center text-sm font-normal"
        onClick={fillAddress}
        disabled={busy}
      >
        {busy ? "Locating…" : "📍 Auto-fill address"}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

export { getPos, geoError };
