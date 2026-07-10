import { StickyNote } from "lucide-react";

/**
 * Upper-right round icon on the Data screen.
 * Dispatches an app-wide event so the active canvas can drop a standalone
 * note flag / open dictation. Wiring lives in the Data canvas.
 */
export function NoteTool() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("app:add-note"))}
      className="fixed z-40 top-11 right-2 h-8 w-8 rounded-full bg-background/90 backdrop-blur border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
      aria-label="Add note"
    >
      <StickyNote className="h-4 w-4" />
    </button>
  );
}
