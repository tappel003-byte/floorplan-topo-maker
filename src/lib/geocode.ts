// Address autofill via browser geolocation + OpenStreetMap Nominatim (no API key).
// Nominatim usage policy: identify with a User-Agent / Referer, ≤1 req/s.

export interface GeocodedAddress {
  formatted: string;
  lat: number;
  lon: number;
}

export interface AccuracyProgress {
  accuracy: number; // meters
  elapsedMs: number;
}

export interface AccurateOptions {
  /** Stop early once accuracy (m) is at or below this. Default 8. */
  desiredAccuracy?: number;
  /** Hard cap on total time. Default 20s. */
  maxWaitMs?: number;
  /** Minimum time to collect samples even if first fix looks good. Default 4s. */
  minWaitMs?: number;
  onProgress?: (p: AccuracyProgress) => void;
  signal?: AbortSignal;
}

/**
 * Get a single fix (legacy). Prefer getAccuratePosition() for address autofill —
 * the first GPS fix on mobile is usually a coarse cell/wifi estimate (50–500m).
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

/**
 * Watch position and return the most accurate fix, stopping early once the
 * desired accuracy is reached (and at least minWaitMs has passed to let the
 * GPS chip settle past its initial coarse estimate).
 */
export function getAccuratePosition(
  opts: AccurateOptions = {},
): Promise<GeolocationPosition> {
  const {
    desiredAccuracy = 8,
    maxWaitMs = 20000,
    minWaitMs = 4000,
    onProgress,
    signal,
  } = opts;

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available on this device."));
      return;
    }
    const start = Date.now();
    let best: GeolocationPosition | null = null;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      fn();
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const elapsed = Date.now() - start;
        onProgress?.({ accuracy: pos.coords.accuracy, elapsedMs: elapsed });
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (best.coords.accuracy <= desiredAccuracy && elapsed >= minWaitMs) {
          finish(() => resolve(best!));
        }
      },
      (err) => {
        // Only reject if we never got a fix. Otherwise fall through to timer.
        if (!best) finish(() => reject(err));
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 },
    );

    const timer = setTimeout(() => {
      if (best) finish(() => resolve(best!));
      else
        finish(() =>
          reject(
            new Error(
              "Could not get a GPS fix. Move outside or near a window and try again.",
            ),
          ),
        );
    }, maxWaitMs);

    signal?.addEventListener("abort", () =>
      finish(() => reject(new DOMException("Aborted", "AbortError"))),
    );
  });
}


export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<GeocodedAddress> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = (await res.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  const a = data.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? "";
  const state = a.state ?? a.region ?? "";
  const zip = a.postcode ?? "";
  const compact = [street, city, [state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return {
    formatted: compact || data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    lat,
    lon,
  };
}

export async function fillAddressFromLocation(
  opts: AccurateOptions = {},
): Promise<GeocodedAddress & { accuracy: number }> {
  const pos = await getAccuratePosition(opts);
  const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
  return { ...geo, accuracy: pos.coords.accuracy };
}
