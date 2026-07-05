import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { fillAddressFromLocation } from "@/lib/geocode";

interface Props {
  onFilled: (address: string) => void;
}

/** Compact button that fills an address field from GPS + reverse geocoding. */
export function AddressLocateButton({ onFilled }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fillAddressFromLocation();
      onFilled(res.formatted);
    } catch (e: unknown) {
      const msg =
        e instanceof GeolocationPositionError
          ? e.code === 1
            ? "Location permission denied."
            : e.code === 2
              ? "Location unavailable."
              : "Location request timed out."
          : e instanceof Error
            ? e.message
            : "Could not get location.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handle}
        disabled={busy}
        aria-label="Use current location"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <MapPin className="h-4 w-4 mr-1" />
        )}
        {busy ? "Locating…" : "Use my location"}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
