import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { COMMON_SURFACES, formatDelta } from "@/lib/transitions";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    surfaceA: string;
    surfaceB: string;
    readingA: number;
    readingB: number;
  }) => void;
}

/**
 * Sheet for creating a flooring transition. Sits over the keypad. User picks
 * two surfaces (may be the same) and enters both readings taken at the
 * doorway. On save, the parent plots the anchor point at the pending
 * location (value = readingA) and records the transition.
 */
export function AddTransitionSheet({ open, onClose, onSave }: Props) {
  const [surfaceA, setSurfaceA] = useState<string>("Tile");
  const [surfaceB, setSurfaceB] = useState<string>("Carpet");
  const [readingA, setReadingA] = useState<string>("");
  const [readingB, setReadingB] = useState<string>("");

  useEffect(() => {
    if (open) {
      setReadingA("");
      setReadingB("");
    }
  }, [open]);

  if (!open) return null;

  const a = parseFloat(readingA);
  const b = parseFloat(readingB);
  const valid = isFinite(a) && isFinite(b);
  const delta = valid ? a - b : 0;

  function submit() {
    if (!valid) return;
    onSave({ surfaceA, surfaceB, readingA: a, readingB: b });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Add Transition
            </div>
            <div className="text-sm font-semibold">Flooring change at this location</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Surface A (reference)</span>
            <select
              value={surfaceA}
              onChange={(e) => setSurfaceA(e.target.value)}
              className="h-10 rounded-md border px-2 bg-background text-sm"
            >
              {COMMON_SURFACES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Surface B (other side)</span>
            <select
              value={surfaceB}
              onChange={(e) => setSurfaceB(e.target.value)}
              className="h-10 rounded-md border px-2 bg-background text-sm"
            >
              {COMMON_SURFACES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Reading A"</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={readingA}
              onChange={(e) => setReadingA(e.target.value)}
              placeholder="9.0"
              className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Reading B"</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={readingB}
              onChange={(e) => setReadingB(e.target.value)}
              placeholder="8.6"
              className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background"
            />
          </label>
        </div>

        <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">Delta (B → A)</span>
          <span className="font-mono tabular-nums font-semibold">
            {valid ? `${formatDelta(delta)}"` : "—"}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Plots a diamond anchor at Reading A. Subsequent points on {surfaceB || "the other side"}{" "}
          will display as <span className="font-mono">raw{formatDelta(delta || 0.4)}</span>.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Save transition
          </Button>
        </div>
      </div>
    </div>
  );
}
