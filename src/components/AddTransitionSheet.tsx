import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Link2 } from "lucide-react";
import { COMMON_SURFACES, formatDelta } from "@/lib/transitions";

/** One ancestor in the active chain, ordered nearest parent → root. */
export interface AncestorOption {
  id: string;
  /** The surface on the "downstream" side of that ancestor (its surfaceB) —
   * the surface you're standing on when you take a raw reading against it. */
  surface: string;
  /** ancestor.readingA − ancestor.readingB. Adding this to a raw reading
   * taken on `surface` yields the base-frame value. */
  delta: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    surfaceA: string;
    surfaceB: string;
    readingA: number; // base-frame (already includes parentDelta if chained)
    readingB: number;
    readingARawOnParent?: number; // what the user typed, if chained
    /** Chosen ancestor id when chaining; undefined for a fresh (unchained) transition. */
    parentId?: string;
  }) => void;
  /** Ancestors of the currently-active transition (nearest parent first, root last).
   * When non-empty, the sheet enters "chained" mode and lets the user pick which
   * ancestor to branch from — matches the real hub/branch flow in the field. */
  ancestors?: AncestorOption[];
}

/**
 * Sheet for creating a flooring transition. User picks two surfaces and
 * enters both raw readings taken at the doorway. When ancestors are provided,
 * Reading A is a raw reading on the *selected* ancestor's surface and is
 * converted to base-frame using that ancestor's stored delta.
 */
export function AddTransitionSheet({ open, onClose, onSave, ancestors }: Props) {
  const chained = !!ancestors && ancestors.length > 0;
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [surfaceA, setSurfaceA] = useState<string>("Tile");
  const [surfaceB, setSurfaceB] = useState<string>("Carpet");
  const [readingA, setReadingA] = useState<string>("");
  const [readingB, setReadingB] = useState<string>("");

  // Dedupe ancestors by surface so the picker isn't cluttered when two
  // ancestors happen to share a surface — we key by id but display by surface.
  const ancestorOptions = useMemo(() => ancestors ?? [], [ancestors]);

  useEffect(() => {
    if (open) {
      setReadingA("");
      setReadingB("");
      if (chained) {
        // Default to the nearest parent (index 0) — that's the most common case.
        const first = ancestorOptions[0];
        setSelectedParentId(first.id);
        setSurfaceA(first.surface);
      }
    }
  }, [open, chained, ancestorOptions]);

  if (!open) return null;

  const selectedAncestor = chained
    ? ancestorOptions.find((a) => a.id === selectedParentId) ?? ancestorOptions[0]
    : undefined;
  const parentDelta = selectedAncestor?.delta ?? 0;

  const aRaw = parseFloat(readingA);
  const b = parseFloat(readingB);
  const valid = isFinite(aRaw) && isFinite(b);
  const aBase = valid ? aRaw + parentDelta : 0;
  const delta = valid ? aBase - b : 0;

  function submit() {
    if (!valid) return;
    onSave({
      surfaceA,
      surfaceB,
      readingA: aBase,
      readingB: b,
      readingARawOnParent: chained ? aRaw : undefined,
      parentId: selectedAncestor?.id,
    });
  }

  function onPickParent(id: string) {
    setSelectedParentId(id);
    const a = ancestorOptions.find((x) => x.id === id);
    if (a) setSurfaceA(a.surface);
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

        {chained && selectedAncestor && (
          <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs flex items-start gap-2">
            <Link2 className="h-3.5 w-3.5 mt-0.5 text-amber-600" />
            <div>
              <div className="font-medium text-amber-900 dark:text-amber-200">
                Chained from {selectedAncestor.surface} ({formatDelta(parentDelta)}")
              </div>
              <div className="text-amber-800/80 dark:text-amber-200/70">
                Pick which anchor in this chain you're branching from. Reading A is a raw
                reading on that surface; the app converts it to the base datum.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {chained ? "Branch from (chain)" : "From surface (reference)"}
            </span>
            {chained ? (
              <select
                value={selectedParentId}
                onChange={(e) => onPickParent(e.target.value)}
                className="h-10 rounded-md border px-2 bg-background text-sm"
              >
                {ancestorOptions.map((a, i) => (
                  <option key={a.id} value={a.id}>
                    {a.surface}
                    {i === 0 ? " (current)" : i === ancestorOptions.length - 1 ? " (root)" : ""}
                  </option>
                ))}
              </select>
            ) : (
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
            )}
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
              {surfaceA || "From"} reading" {chained ? "(raw)" : ""}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={readingA}
              onChange={(e) => setReadingA(e.target.value)}
              placeholder="0.0"
              className="h-12 rounded-md border px-3 text-lg font-mono tabular-nums text-right bg-background placeholder:text-muted-foreground/25"
              autoFocus
            />
            {chained && valid && (
              <span className="text-[10px] text-muted-foreground font-mono">
                = {aBase.toFixed(2)}" corrected
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{surfaceB || "To"} reading" (raw)</span>
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
        <p className="mt-2 text-[11px] text-muted-foreground">
          Plots a diamond anchor. Subsequent {surfaceB || "surface"} readings display as{" "}
          <span className="font-mono">raw {formatDelta(delta || 0.4)}</span> ({surfaceB || "surface"} correction).
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
