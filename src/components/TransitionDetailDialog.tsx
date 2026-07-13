import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, X, Minus, Maximize2 } from "lucide-react";
import { COMMON_SURFACES, formatDelta } from "@/lib/transitions";
import type { Transition } from "@/lib/types";

interface Props {
  open: boolean;
  transition: Transition | null;
  downstreamCount: number;
  onClose: () => void;
  onSave: (t: Transition) => void;
  onDelete: () => void;
  /** Optional anchor-relative placement. When omitted, floats bottom-center. */
  positionScreen?: { left: number; top: number };
}

/** Dialog opened when the diamond anchor is tapped. Edit readings/surfaces or delete. */
export function TransitionDetailDialog({
  open,
  transition,
  downstreamCount,
  onClose,
  onSave,
  onDelete,
  positionScreen,
}: Props) {
  const [surfaceA, setSurfaceA] = useState("");
  const [surfaceB, setSurfaceB] = useState("");
  const [readingA, setReadingA] = useState("");
  const [readingB, setReadingB] = useState("");
  const [overrideDelta, setOverrideDelta] = useState<number | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (open && transition) {
      setSurfaceA(transition.surfaceA);
      setSurfaceB(transition.surfaceB);
      setReadingA(String(transition.readingA));
      setReadingB(String(transition.readingB));
      setOverrideDelta(
        transition.manualDeltaOverride !== undefined ? transition.manualDeltaOverride : null,
      );
      setMinimized(false);
    }
  }, [open, transition]);

  if (!open || !transition) return null;

  const a = parseFloat(readingA);
  const b = parseFloat(readingB);
  const valid = isFinite(a) && isFinite(b);
  const computedDelta = valid ? a - b : 0;
  const effectiveDelta = overrideDelta !== null ? overrideDelta : computedDelta;
  const isOverridden = overrideDelta !== null;

  function submit() {
    if (!valid || !transition) return;
    onSave({
      ...transition,
      surfaceA,
      surfaceB,
      readingA: a,
      readingB: b,
      manualDeltaOverride: overrideDelta ?? undefined,
    });
  }

  function onReadingAChange(v: string) {
    setReadingA(v);
    setOverrideDelta(null);
  }
  function onReadingBChange(v: string) {
    setReadingB(v);
    setOverrideDelta(null);
  }

  if (minimized) {
    const deltaLabel = formatDelta(effectiveDelta);
    return (
      <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background shadow-lg pl-3 pr-1 h-9">
          <button
            onClick={() => setMinimized(false)}
            className="flex items-center gap-1.5 text-xs font-medium"
            aria-label="Expand transition"
          >
            <span className="text-muted-foreground">{transition.surfaceB} correction</span>
            <span className={`font-mono font-semibold ${isOverridden ? "text-destructive" : ""}`}>{deltaLabel}"</span>
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(false)} aria-label="Expand">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  function nudgeDelta(step: number) {
    const base = overrideDelta !== null ? overrideDelta : computedDelta;
    const next = Math.round((base + step) * 100) / 100;
    setOverrideDelta(next);
  }


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
      <div className="w-[min(20rem,calc(100vw-1rem))] pointer-events-none">

      <div
        className="bg-background rounded-xl shadow-2xl border p-4 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Transition
            </div>
            <div className="text-sm font-semibold">Anchor reference point</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setMinimized(true)} aria-label="Minimize">
              <Minus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">From surface</span>
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
            <span className="text-xs text-muted-foreground">To surface</span>
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
            <span className="text-xs text-muted-foreground">{surfaceA || "From"} reading"</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={readingA}
              onChange={(e) => setReadingA(e.target.value)}
              placeholder="0.0"
              className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background placeholder:text-muted-foreground/25"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{surfaceB || "To"} reading"</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={readingB}
              onChange={(e) => setReadingB(e.target.value)}
              placeholder="0.0"
              className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background placeholder:text-muted-foreground/25"
            />
          </label>
        </div>

        <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">
            {surfaceB || "Surface"} correction
          </span>
          <span className="font-mono tabular-nums font-semibold">
            {valid ? `${formatDelta(delta)}"` : "—"}
          </span>
        </div>

        <div className="mt-2 rounded-md border bg-muted/20 px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Manual adjust</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => nudgeDelta(-0.1)} aria-label="Decrease correction 0.1">
              −0.1
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => nudgeDelta(0.1)} aria-label="Increase correction 0.1">
              +0.1
            </Button>
          </div>
        </div>

        {downstreamCount > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {downstreamCount} downstream point{downstreamCount === 1 ? "" : "s"} reference this
            transition. Editing readings updates all of them.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!valid}>
              Save
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

