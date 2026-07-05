// Address autofill via browser geolocation + OpenStreetMap Nominatim (no API key).
// Nominatim usage policy: identify with a User-Agent / Referer, ≤1 req/s.

export interface GeocodedAddress {
  formatted: string;
  lat: number;
  lon: number;
}

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

export async function fillAddressFromLocation(): Promise<GeocodedAddress> {
  const pos = await getCurrentPosition();
  return reverseGeocode(pos.coords.latitude, pos.coords.longitude);
}
