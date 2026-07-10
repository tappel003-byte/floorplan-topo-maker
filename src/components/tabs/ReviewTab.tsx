import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit3, AlertTriangle } from "lucide-react";
import type { Floor, SurveyPoint } from "@/lib/types";
import { deletePoint, savePoint } from "@/lib/db";

interface Props {
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}

export function ReviewTab({ points, onPointsChange, selectedIds, setSelectedIds }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteVal, setNoteVal] = useState("");

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

  async function commitEdit(p: SurveyPoint) {
    const n = parseFloat(editVal);
    if (!isFinite(n)) return;
    const updated = { ...p, value: n };
    await savePoint(updated);
    onPointsChange(points.map((x) => (x.id === p.id ? updated : x)));
    setEditingId(null);
  }

  async function remove(p: SurveyPoint) {
    if (!confirm(`Delete point #${p.index}?`)) return;
    await deletePoint(p.id);
    onPointsChange(points.filter((x) => x.id !== p.id));
  }

  async function commitNote(p: SurveyPoint) {
    const updated = { ...p, notes: noteVal.trim() };
    await savePoint(updated);
    onPointsChange(points.map((x) => (x.id === p.id ? updated : x)));
    setNoteId(null);
  }

  return (
    <div className="flex flex-col h-full">
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
            No points captured yet. Switch to Field mode.
          </div>
        ) : (
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-10" />
              <col className="w-20" />
              <col className="w-20" />
              <col />
              <col className="w-20" />
            </colgroup>
            <thead className="text-xs text-muted-foreground bg-muted/40 sticky top-0">
              <tr>
                <th className="text-left px-2 py-2">#</th>
                <th className="text-left px-2 py-2">Kind</th>
                <th className="text-right px-2 py-2">Value</th>
                <th className="text-left px-2 py-2">Notes</th>
                <th className="text-right px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => {
                return (
                <tr
                  key={p.id}
                  onClick={(e) => {
                    if (e.shiftKey || e.metaKey) {
                      const next = new Set(selectedIds);
                      next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                      setSelectedIds(next);
                    } else {
                      setSelectedIds(new Set([p.id]));
                    }
                  }}
                  className={
                    "border-t cursor-pointer " +
                    (selectedIds.has(p.id) ? "bg-primary/10" : "hover:bg-muted/30")
                  }
                >
                  <td className="px-2 py-1.5 font-mono">{p.index}</td>
                  <td className="px-2 py-1.5">
                    {p.isBasePoint ? (
                      <span className="rounded bg-green-100 text-green-800 px-1.5 py-0.5 text-xs font-medium">
                        {p.label ?? "BP1"}
                      </span>
                    ) : outliers.has(p.id) ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums font-semibold">
                    {editingId === p.id ? (
                      <Input
                        autoFocus
                        type="number"
                        inputMode="decimal"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => commitEdit(p)}
                        onKeyDown={(e) => e.key === "Enter" && commitEdit(p)}
                        className="h-8 text-right"
                      />
                    ) : (
                      p.value.toFixed(2)
                    )}
                  </td>

                  <td className="px-2 py-1.5">
                    {noteId === p.id ? (
                      <Textarea
                        autoFocus
                        rows={2}
                        value={noteVal}
                        onChange={(e) => setNoteVal(e.target.value)}
                        onBlur={() => commitNote(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitNote(p);
                        }}
                        className="text-xs"
                      />
                    ) : (
                      <button
                        className="text-left text-xs text-muted-foreground hover:text-foreground w-full truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteId(p.id);
                          setNoteVal(p.notes ?? "");
                        }}
                      >
                        {p.notes || "Add note"}
                      </button>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-right whitespace-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(p.id);
                        setEditVal(String(p.value));
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(p);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
                );
              })}
              <tr><td colSpan={6} className="h-24" /></tr>
            </tbody>
          </table>
        )}
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
