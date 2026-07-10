import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, X } from "lucide-react";
import type { NotePin } from "@/lib/types";

export function NoteDialog({
  pin,
  onClose,
  onSave,
  onDelete,
}: {
  pin: NotePin;
  onClose: () => void;
  onSave: (text: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [text, setText] = useState(pin.text);
  useEffect(() => { setText(pin.text); }, [pin.id]);

  const dirty = text !== pin.text;

  async function save() {
    await onSave(text);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-sm rounded-lg border bg-popover shadow-lg flex flex-col">
        <div className="flex items-center justify-between px-3 h-9 border-b">
          <span className="text-xs font-semibold">Note N{pin.index}</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or tap the mic on your keyboard…"
            className="text-sm"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between gap-2 p-3 border-t">
          <Button size="sm" variant="outline" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={!dirty}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
