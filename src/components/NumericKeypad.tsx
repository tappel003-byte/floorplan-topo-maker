import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Delete, Check, X, Repeat2, Trash2 } from "lucide-react";

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
  secondaryAction,
  onDelete,
}: Props) {
  const [text, setText] = useState<string>("");

  const parsedText = parseFloat(text);
  const hasTypedValue = text.trim() !== "" && isFinite(parsedText);
  const canUseRepeatValue = repeatValue != null && isFinite(repeatValue);
  const actionableValue = hasTypedValue ? parsedText : canUseRepeatValue ? repeatValue : undefined;

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
      if (k >= "0" && k <= "9") { e.preventDefault(); push(k); return; }
      if (k === "." || k === ",") { e.preventDefault(); push("."); return; }
      if (k === "Backspace") { e.preventDefault(); backspace(); return; }
      if (k === "-") { e.preventDefault(); toggleSign(); return; }
      if (k === "Enter" || k === "=") {
        e.preventDefault();
        const n = parseFloat(text);
        if (isFinite(n)) onSubmit(n);
        else if (repeatValue != null && isFinite(repeatValue)) onSubmit(repeatValue);
        return;
      }
      if (k === "Escape") { e.preventDefault(); onClose(); return; }
      if (k === "r" || k === "R") {
        if (repeatValue != null && isFinite(repeatValue)) { e.preventDefault(); onSubmit(repeatValue); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, text, repeatValue, onSubmit, onClose]);

  if (!open) return null;

  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl shadow-2xl p-4 pb-6 max-w-md w-full mx-auto max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
            {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
        </div>
        <div className="mb-3 rounded-lg border bg-muted/40 px-4 py-3 text-right text-4xl font-mono tabular-nums h-16 flex items-center justify-end">
          {text || (
            <span className="text-muted-foreground/60">
              {repeatValue != null ? repeatValue.toFixed(2) : "0.0"}
            </span>
          )}
        </div>
        {repeatValue != null && (
          <button
            onClick={repeatLast}
            className="mb-3 w-full h-11 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Repeat2 className="h-4 w-4" /> Repeat last ({repeatValue.toFixed(2)})
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={() => {
              if (actionableValue != null) secondaryAction.onClick(actionableValue);
            }}
            disabled={secondaryAction.disabled || actionableValue == null}
            className="mb-3 w-full h-11 rounded-lg border border-dashed border-amber-500/60 bg-amber-50 text-amber-900 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-40"
          >
            {secondaryAction.label}
          </button>
        )}
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <KeyBtn key={k} onClick={() => push(k)}>{k}</KeyBtn>
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
            className="col-span-2 h-16 rounded-lg bg-primary text-primary-foreground text-xl font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check className="h-6 w-6" /> Enter
          </button>
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
        "h-16 rounded-lg bg-secondary hover:bg-secondary/80 text-2xl font-semibold active:scale-95 transition-transform " +
        className
      }
    >
      {children}
    </button>
  );
}
