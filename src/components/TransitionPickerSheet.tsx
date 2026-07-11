import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { formatDelta, transitionDelta } from "@/lib/transitions";
import type { Transition } from "@/lib/types";

interface Props {
  open: boolean;
  transitions: readonly Transition[];
  onClose: () => void;
  /** Reuse an existing transition — tags the pending point as downstream of it. */
  onReuse: (id: string) => void;
  /** Open the full new-transition editor. */
  onNew: () => void;
}

/**
 * Bottom sheet shown when the user taps "+ Transition" in the keypad.
 * Lists recent transitions on this floor for one-tap reuse, plus a
 * "New transition" tile that opens the full editor.
 */
export function TransitionPickerSheet({ open, transitions, onClose, onReuse, onNew }: Props) {
  if (!open) return null;

  // Most-recent first, cap at 6 tiles so the sheet stays compact.
  const recent = [...transitions]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl shadow-2xl p-4 pb-6 max-w-md w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Apply a transition</div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {recent.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Reuse
            </div>
            <div className="grid grid-cols-1 gap-2 mb-3">
              {recent.map((t) => {
                const d = transitionDelta(t);
                return (
                  <button
                    key={t.id}
                    onClick={() => onReuse(t.id)}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 h-12 text-left active:scale-[0.99]"
                  >
                    <ArrowLeftRight className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-sm">
                      <span className="text-muted-foreground">{t.surfaceA}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">{t.surfaceB}</span>
                    </span>
                    <span className="font-mono tabular-nums text-sm font-semibold shrink-0">
                      {formatDelta(d)}"
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-lg border border-dashed border-primary/50 bg-primary/5 text-primary text-sm font-medium active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" /> New transition
        </button>
      </div>
    </div>
  );
}
