import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  initialText?: string;
  isNew: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  onDelete?: () => void;
}

export function NoteDialog({ open, initialText = "", isNew, onClose, onSave, onDelete }: Props) {
  const [text, setText] = useState(initialText);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText(initialText);
      // Focus after paint so mobile keyboard opens.
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open, initialText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{isNew ? "Add note" : "Edit note"}</h3>
          {!isNew && onDelete && (
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete note"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. +0.3 in field, tile to carpet"
          className="w-full min-h-[110px] rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const t = text.trim();
              if (t) onSave(t);
              else if (!isNew && onDelete) onDelete();
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
