import { useMemo, useState } from "react";
import { AlertTriangle, X, StickyNote } from "lucide-react";
import type { Floor, SurveyPoint } from "@/lib/types";
import { deletePoint, savePoint } from "@/lib/db";
import { PointDetail } from "@/components/PointDetail";


interface Props {
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  onClose?: () => void;
}

export function ReviewTab({ points, onPointsChange, selectedIds, setSelectedIds, onClose }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance);
    return { min, max, mean, std, range: max - min };
  }, [points]);

  const outliers = useMemo(() => {
    if (!stats || points.length < 4) return new Set<string>();
    const set = new Set<string>();
    for (const p of points) {
      if (Math.abs(p.value - stats.mean) > 2 * stats.std) set.add(p.id);
    }
    return set;
  }, [points, stats]);

  const detail = detailId ? points.find((p) => p.id === detailId) ?? null : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-3 h-9">
        <span className="text-xs font-semibold">Review</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Close review"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {stats && (
        <div className="border-b p-3 grid grid-cols-4 gap-2 text-center text-xs">
          <Stat label="Points" value={points.length.toString()} />
          <Stat label="Range" value={stats.range.toFixed(2) + '"'} />
          <Stat label="Min" value={stats.min.toFixed(2) + '"'} />
          <Stat label="Max" value={stats.max.toFixed(2) + '"'} />
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {points.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No points captured yet. Switch to Data mode.
          </div>
        ) : (
          <ul className="divide-y">
            {points.map((p) => {
              const selected = selectedIds.has(p.id);
              return (
                <li
                  key={p.id}
                  onClick={(e) => {
                    if (e.shiftKey || e.metaKey) {
                      const next = new Set(selectedIds);
                      next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                      setSelectedIds(next);
                      return;
                    }
                    setSelectedIds(new Set([p.id]));
                    setDetailId(p.id);
                  }}
                  className={
                    "flex items-start gap-2 px-3 py-2 cursor-pointer " +
                    (selected ? "bg-primary/10" : "hover:bg-muted/30")
                  }
                >
                  <span className="font-mono text-xs text-muted-foreground w-6 pt-0.5 tabular-nums">
                    {p.index}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold tabular-nums">
                        {p.value.toFixed(2)}"
                      </span>
                      {p.isBasePoint && (
                        <span className="rounded bg-green-100 text-green-800 px-1.5 py-0.5 text-[10px] font-medium">
                          {p.label ?? "BP"}
                        </span>
                      )}
                      {outliers.has(p.id) && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px]">
                          <AlertTriangle className="h-3 w-3" />
                          outlier
                        </span>
                      )}
                      {p.notes && <StickyNote className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                    {p.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                        {p.notes}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
            <li className="h-24" />
          </ul>
        )}
      </div>

      {detail && (
        <PointDetail
          key={detail.id}
          point={detail}
          onClose={() => setDetailId(null)}
          onSave={async (updated) => {
            await savePoint(updated);
            onPointsChange(points.map((x) => (x.id === updated.id ? updated : x)));
          }}
          onDelete={async () => {
            if (!confirm(`Delete point #${detail.index}?`)) return;
            await deletePoint(detail.id);
            onPointsChange(points.filter((x) => x.id !== detail.id));
            setDetailId(null);
          }}
        />
      )}
    </div>
  );
}

function PointDetail({
  point,
  onClose,
  onSave,
  onDelete,
}: {
  point: SurveyPoint;
  onClose: () => void;
  onSave: (p: SurveyPoint) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [value, setValue] = useState(String(point.value));
  const [notes, setNotes] = useState(point.notes ?? "");

  useEffect(() => {
    setValue(String(point.value));
    setNotes(point.notes ?? "");
  }, [point.id]);

  const dirty = value !== String(point.value) || notes !== (point.notes ?? "");

  async function save() {
    const n = parseFloat(value);
    if (!isFinite(n)) return;
    await onSave({ ...point, value: n, notes: notes.trim() });
    onClose();
  }

  return (
    <div className="absolute inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-sm rounded-lg border bg-popover shadow-lg flex flex-col">
        <div className="flex items-center justify-between px-3 h-9 border-b">
          <span className="text-xs font-semibold">Point #{point.index}</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Elevation</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-10 text-right font-mono text-base mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Note</label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note…"
              className="text-sm mt-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 p-3 border-t">
          <Button size="sm" variant="outline" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-mono text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}
