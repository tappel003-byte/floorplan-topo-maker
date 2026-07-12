import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
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
 * Every doorway is measured fresh — no reuse list.
 */
export function TransitionPickerSheet({ open, onClose, onNew }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl shadow-2xl p-4 pb-6 max-w-md w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Transitions in this house</div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

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

