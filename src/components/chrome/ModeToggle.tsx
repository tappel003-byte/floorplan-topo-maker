import { Pointer, Layers3 } from "lucide-react";

type Mode = "data" | "topo";

/**
 * Vertical Data/Topo pill anchored to the lower-left corner on every screen.
 * The only wider control in the corner set — everything else is a round icon.
 */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      className="fixed z-10 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-[calc(env(safe-area-inset-left)+0.75rem)] flex flex-row items-center rounded-full bg-background/90 backdrop-blur border shadow-lg p-1 gap-1"
      role="tablist"
      aria-label="Mode"
    >
      <Btn
        active={mode === "data"}
        onClick={() => onChange("data")}
        icon={<Pointer className="h-4 w-4" />}
        label="Data"
      />
      <Btn
        active={mode === "topo"}
        onClick={() => onChange("topo")}
        icon={<Layers3 className="h-4 w-4" />}
        label="Topo"
      />
    </div>
  );
}

function Btn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "flex flex-row items-center justify-center gap-1 h-7 px-2.5 rounded-full text-[11px] leading-none transition-colors " +
        (active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
