import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, X } from "lucide-react";
import type { SurveyPoint } from "@/lib/types";

export function PointDetail({
  point,
  onClose,
  onSave,
  onDelete,
}: {
  point: SurveyPoint;
  onClose: () => void;
  onSave: (p: SurveyPoint) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
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
    <div className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
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
