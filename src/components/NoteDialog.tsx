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
    <div className="fixed left-2 right-2 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[80] flex justify-center pointer-events-none">
      <div className="w-full max-w-sm max-h-[calc(100dvh-5rem)] rounded-lg border bg-popover shadow-lg flex flex-col pointer-events-auto">
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
