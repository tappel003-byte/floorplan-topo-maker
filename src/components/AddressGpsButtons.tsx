import { useState } from "react";
import { SetSquareIcon } from "@/components/SetSquareIcon";

interface Props {
  onAddress: (addr: string) => void;
}

function getPos(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(Object.assign(new Error("GPS not available"), { code: 2 }));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(
        Object.assign(new Error("GPS requires HTTPS — type the address instead."), { code: 2 }),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

function geoError(e: unknown): string {
  const err = e as GeolocationPositionError & { message?: string; code?: number };
  if (err?.code === 1) return "Location permission denied — type the address instead.";
  if (err?.code === 3) return "Location timed out — type the address instead.";
  if (typeof err?.message === "string" && err.message.includes("HTTPS")) return err.message;
  return err?.message || "Could not get location — type the address instead.";
}

function formatAddress(
  data: { display_name?: string; address?: Record<string, string | undefined> },
  lat: number,
  lon: number,
) {
  const a = data.address || {};
  const house = a.house_number || "";
  const road = a.road || a.pedestrian || a.footway || "";
  const city = a.city || a.town || a.village || a.hamlet || a.suburb || "";
  const state = a.state || "";
  const parts: string[] = [];
  const line1 = [house, road].filter(Boolean).join(" ").trim();
  if (line1) parts.push(line1);
  if (city) parts.push(city);
  if (state) parts.push(state);
  return parts.length ? parts.join(", ") : data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * Distress Survey address actions: Auto-fill + Use coordinates.
 * House GPS for the topo origin stays on Set Base Point.
 */
export function AddressGpsButtons({ onAddress }: Props) {
  const [busy, setBusy] = useState<"address" | "coords" | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function fillAddress() {
    setBusy("address");
    setHint("Getting your location…");
    try {
      const pos = await getPos();
      const { latitude: lat, longitude: lon } = pos.coords;
      setHint("Looking up address…");
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
          { headers: { Accept: "application/json" }, signal: ctrl.signal },
        );
        if (!res.ok) throw new Error("lookup failed");
        const data = (await res.json()) as {
          display_name?: string;
          address?: Record<string, string | undefined>;
        };
        onAddress(formatAddress(data, lat, lon));
        setHint(`Located: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } catch {
        onAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        setHint("No signal for address lookup — used coordinates.");
      } finally {
        window.clearTimeout(t);
      }
    } catch (e) {
      setHint(geoError(e));
    } finally {
      setBusy(null);
    }
  }

  async function fillCoords() {
    setBusy("coords");
    setHint("Getting your location…");
    try {
      const pos = await getPos();
      const { latitude: lat, longitude: lon } = pos.coords;
      onAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      setHint(`Coordinates captured (±${Math.round(pos.coords.accuracy || 0)}m).`);
    } catch (e) {
      setHint(geoError(e));
    } finally {
      setBusy(null);
    }
  }

  const btnClass =
    "flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-[14px] text-foreground disabled:opacity-50";

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" disabled={!!busy} onClick={() => void fillAddress()} className={btnClass}>
          <span aria-hidden>📍</span>
          <span>{busy === "address" ? "… locating" : "Auto-fill address"}</span>
        </button>
        <button type="button" disabled={!!busy} onClick={() => void fillCoords()} className={btnClass}>
          <SetSquareIcon className="h-5 w-5 shrink-0" />
          <span>{busy === "coords" ? "… locating" : "Use coordinates"}</span>
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export { getPos, geoError };
