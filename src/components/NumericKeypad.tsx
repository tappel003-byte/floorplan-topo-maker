import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Delete, Check, X, Repeat2, Trash2, ArrowLeftRight, Undo2 } from "lucide-react";

interface ActiveTransition {
  label: string; // e.g. "→ Carpet"
  delta: number; // signed
}

interface Props {
  open: boolean;
  initialValue?: number;
  /** Previous point's value — shown as ghost + one-tap "Repeat" button. Not prefilled. */
  repeatValue?: number;
  title?: string;
  subtitle?: string;
  onSubmit: (value: number) => void;
  onClose: () => void;
  /** When provided, shows a trash button in the header. Used for editing existing points. */
  onDelete?: () => void;
  /** When provided, shows an "Add Transition" button in the header. Only used when placing new points. */
  onAddTransition?: () => void;
  /** When set, keypad shows an active-transition chip and reflects delta on the Enter button. */
  activeTransition?: ActiveTransition | null;
  /** Called when the user taps the X on the active-transition chip. */
  onRemoveTransition?: () => void;
  /** When provided, shows an Undo button in the header. */
  onUndo?: () => void;
  canUndo?: boolean;
}

/** Large arm's-length numeric keypad (bottom sheet). */
export function NumericKeypad({
  open,
  initialValue,
  repeatValue,
  title = "Elevation",
  subtitle,
  onSubmit,
  onClose,
  onDelete,
  onAddTransition,
  activeTransition,
  onRemoveTransition,
  onUndo,
  canUndo,
}: Props) {

  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (open) setText(initialValue != null ? String(initialValue) : "");
  }, [open, initialValue]);

  useEffect(() => {
    if (open) setText(initialValue != null ? String(initialValue) : "");
  }, [open, initialValue]);

  function push(ch: string) {
    setText((cur) => {
      if (ch === ".") {
        if (cur.includes(".")) return cur;
        return cur === "" || cur === "-" ? cur + "0." : cur + ".";
      }
      return cur + ch;
    });
  }
  function backspace() {
    setText((c) => c.slice(0, -1));
  }
  function toggleSign() {
    setText((c) => (c.startsWith("-") ? c.slice(1) : "-" + c));
  }
  function submit() {
    const n = parseFloat(text);
    if (isFinite(n)) onSubmit(n);
  }
  function repeatLast() {
    if (repeatValue != null && isFinite(repeatValue)) onSubmit(repeatValue);
  }

  // Hardware keyboard support (desktop numpad + main row)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const k = e.key;
      if (k >= "0" && k <= "9") {
        e.preventDefault();
        push(k);
        return;
      }
      if (k === "." || k === ",") {
        e.preventDefault();
        push(".");
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        backspace();
        return;
      }
      if (k === "-") {
        e.preventDefault();
        toggleSign();
        return;
      }
      if (k === "Enter" || k === "=") {
        e.preventDefault();
        const n = parseFloat(text);
        if (isFinite(n)) onSubmit(n);
        else if (repeatValue != null && isFinite(repeatValue)) onSubmit(repeatValue);
        return;
      }
      if (k === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (k === "r" || k === "R") {
        if (repeatValue != null && isFinite(repeatValue)) {
          e.preventDefault();
          onSubmit(repeatValue);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, text, repeatValue, onSubmit, onClose]);

  if (!open) return null;

  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];

  const hasRepeat = repeatValue != null && isFinite(repeatValue);
  const showShortcutRow = !activeTransition && (hasRepeat || !!onAddTransition);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl shadow-2xl p-4 pb-6 landscape-short:p-3 landscape-short:pb-3 max-w-md landscape-short:max-w-2xl w-full mx-auto max-h-[95dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-1 mb-2">
          <div>
            {onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Undo"
                className="gap-1.5 h-9 px-2 text-muted-foreground disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
                <span className="text-xs">Undo</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label="Delete point"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close keypad">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {activeTransition && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
            <ArrowLeftRight className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              <span className="text-muted-foreground">Transition active · </span>
              <span className="font-mono font-semibold">
                {activeTransition.delta >= 0 ? "+" : "-"}
                {Math.abs(activeTransition.delta).toFixed(1)}
              </span>{" "}
              <span className="text-muted-foreground">{activeTransition.label}</span>
            </span>
            {onRemoveTransition && (
              <button
                onClick={onRemoveTransition}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Remove active transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="landscape-short:grid landscape-short:grid-cols-[1fr_1.4fr] landscape-short:gap-3">
          <div className="landscape-short:flex landscape-short:flex-col landscape-short:justify-center">
            <div className="mb-1 landscape-short:mb-1 rounded-lg border bg-muted/40 px-4 py-3 text-right text-4xl landscape-short:text-3xl font-mono tabular-nums h-16 landscape-short:h-12 flex items-center justify-end">
              {text || (
                <span className="text-muted-foreground/60">
                  {hasRepeat ? repeatValue!.toFixed(2) : "0.0"}
                </span>
              )}
            </div>
            {activeTransition && (() => {
              const rawNum = text ? parseFloat(text) : NaN;
              const rawShown = isFinite(rawNum)
                ? rawNum
                : hasRepeat
                  ? repeatValue!
                  : NaN;
              if (!isFinite(rawShown)) return null;
              const corrected = rawShown + activeTransition.delta;
              return (
                <div className="mb-3 landscape-short:mb-2 px-1 text-right text-xs text-muted-foreground font-mono tabular-nums">
                  = <span className="font-semibold text-foreground">{corrected.toFixed(2)}"</span>
                  <span className="ml-1 opacity-70">
                    ({rawShown.toFixed(2)} {activeTransition.delta >= 0 ? "+" : "−"}{" "}
                    {Math.abs(activeTransition.delta).toFixed(1)} {activeTransition.label})
                  </span>
                </div>
              );
            })()}
            {showShortcutRow && (
              <div className="mb-3 landscape-short:mb-0 flex gap-2">
                {onAddTransition && (
                  <button
                    onClick={onAddTransition}
                    className="flex-1 h-11 landscape-short:h-9 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.99]"
                  >
                    <ArrowLeftRight className="h-4 w-4" /> Transition
                  </button>
                )}
                {hasRepeat && (
                  <button
                    onClick={repeatLast}
                    className="flex-1 h-11 landscape-short:h-9 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.99]"
                  >
                    <Repeat2 className="h-4 w-4" /> Repeat ({repeatValue!.toFixed(2)})
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 landscape-short:gap-1.5">
            {keys.map((k) => (
              <KeyBtn key={k} onClick={() => push(k)}>
                {k}
              </KeyBtn>
            ))}
            <KeyBtn onClick={toggleSign}>±</KeyBtn>
            <KeyBtn onClick={() => push("0")}>0</KeyBtn>
            <KeyBtn onClick={() => push(".")}>.</KeyBtn>
            <KeyBtn onClick={backspace} className="col-span-1">
              <Delete className="h-6 w-6 mx-auto" />
            </KeyBtn>
            <button
              onClick={submit}
              disabled={!text || !isFinite(parseFloat(text))}
              className="col-span-2 h-16 landscape-short:h-10 rounded-lg bg-primary text-primary-foreground text-xl landscape-short:text-base font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Check className="h-6 w-6 landscape-short:h-5 landscape-short:w-5" />
              {activeTransition ? (
                <span>
                  Enter{" "}
                  <span className="font-mono text-base landscape-short:text-sm opacity-90">
                    ({activeTransition.delta >= 0 ? "+" : "-"}
                    {Math.abs(activeTransition.delta).toFixed(1)})
                  </span>
                </span>
              ) : (
                "Enter"
              )}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

function KeyBtn({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "h-16 landscape-short:h-10 rounded-lg bg-secondary hover:bg-secondary/80 text-2xl landscape-short:text-lg font-semibold active:scale-95 transition-transform " +
        className
      }
    >
      {children}
    </button>
  );
}
