import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { COMMON_SURFACES, formatDelta } from "@/lib/transitions";

const SOFT_SURFACES = new Set(["Carpet", "Pad", "Rug"]);

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    surfaceA: string;
    surfaceB: string;
    readingA: number;
    readingB: number;
    readingAFar?: number;
    readingBFar?: number;
  }) => void;
}

/**
 * Sheet for creating a flooring transition. User picks two surfaces and
 * enters raw readings taken at the doorway. Soft surfaces (carpet) also
 * accept an optional far-side reading — the manometer probes through carpet
 * to the slab, and the slab can dip across the room.
 */
export function AddTransitionSheet({ open, onClose, onSave }: Props) {
  const [surfaceA, setSurfaceA] = useState<string>("Tile");
  const [surfaceB, setSurfaceB] = useState<string>("Carpet");
  const [readingA, setReadingA] = useState<string>("");
  const [readingB, setReadingB] = useState<string>("");
  const [readingAFar, setReadingAFar] = useState<string>("");
  const [readingBFar, setReadingBFar] = useState<string>("");

  useEffect(() => {
    if (open) {
      setReadingA("");
      setReadingB("");
      setReadingAFar("");
      setReadingBFar("");
    }
  }, [open]);

  if (!open) return null;

  const aSoft = SOFT_SURFACES.has(surfaceA);
  const bSoft = SOFT_SURFACES.has(surfaceB);

  const a = parseFloat(readingA);
  const b = parseFloat(readingB);
  const aFar = parseFloat(readingAFar);
  const bFar = parseFloat(readingBFar);
  const valid = isFinite(a) && isFinite(b);
  const delta = valid ? a - b : 0;

  function submit() {
    if (!valid) return;
    onSave({
      surfaceA,
      surfaceB,
      readingA: a,
      readingB: b,
      readingAFar: aSoft && isFinite(aFar) ? aFar : undefined,
      readingBFar: bSoft && isFinite(bFar) ? bFar : undefined,
    });
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
            <span className="text-xs text-muted-foreground">From surface (reference)</span>
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
            <span className="text-xs text-muted-foreground">To surface (other side)</span>
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
            <span className="text-xs text-muted-foreground">
              {surfaceA} reading" {aSoft ? "(near door)" : ""}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={readingA}
              onChange={(e) => setReadingA(e.target.value)}
              placeholder="0.0"
              className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {surfaceB} reading" {bSoft ? "(near door)" : ""}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={readingB}
              onChange={(e) => setReadingB(e.target.value)}
              placeholder="0.0"
              className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background"
            />
          </label>

          {aSoft && (
            <label className="flex flex-col gap-1 col-span-1">
              <span className="text-xs text-muted-foreground">
                {surfaceA} reading" (far side, optional)
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={readingAFar}
                onChange={(e) => setReadingAFar(e.target.value)}
                placeholder="0.0"
                className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background"
              />
            </label>
          )}
          {bSoft && (
            <label className={`flex flex-col gap-1 ${aSoft ? "" : "col-start-2"}`}>
              <span className="text-xs text-muted-foreground">
                {surfaceB} reading" (far side, optional)
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={readingBFar}
                onChange={(e) => setReadingBFar(e.target.value)}
                placeholder="—"
                className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background"
              />
            </label>
          )}
        </div>

        <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">
            {surfaceA} → {surfaceB}
          </span>
          <span className="font-mono tabular-nums font-semibold">
            {valid ? `${formatDelta(delta)}"` : "—"}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Plots a diamond anchor. Subsequent points on {surfaceB} display as{" "}
          <span className="font-mono">raw{formatDelta(delta || 0.4)}</span>.
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
