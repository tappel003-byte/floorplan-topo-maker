import { useRef, useState } from "react";
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
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handle() {
    if (busy) {
      abortRef.current?.abort();
      return;
    }
    setErr(null);
    setAccuracy(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fillAddressFromLocation({
        desiredAccuracy: 8,
        minWaitMs: 4000,
        maxWaitMs: 20000,
        signal: ctrl.signal,
        onProgress: ({ accuracy }) => setAccuracy(accuracy),
      });
      setAccuracy(res.accuracy);
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
      abortRef.current = null;
    }
  }

  const accuracyLabel =
    accuracy == null
      ? null
      : accuracy < 1000
        ? `±${Math.round(accuracy)} m`
        : `±${(accuracy / 1000).toFixed(1)} km`;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handle}
        aria-label={busy ? "Cancel location" : "Use current location"}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <MapPin className="h-4 w-4 mr-1" />
        )}
        {busy
          ? accuracyLabel
            ? `Locating… ${accuracyLabel}`
            : "Locating…"
          : "Use my location"}
      </Button>
      {!busy && accuracyLabel && !err && (
        <span className="text-xs text-muted-foreground">Accuracy {accuracyLabel}</span>
      )}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}

