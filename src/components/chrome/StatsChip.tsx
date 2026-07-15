import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { SurveyPoint } from "@/lib/types";

type SizeTier = "sm" | "md" | "lg";
const SIZE_STYLES: Record<
  SizeTier,
  { height: string; text: string; icon: string; pad: string }
> = {
  sm: { height: "h-6", text: "text-[10px]", icon: "w-2.5 h-2.5", pad: "px-1.5" },
  md: { height: "h-8", text: "text-xs", icon: "w-3 h-3", pad: "px-2" },
  lg: { height: "h-10", text: "text-sm", icon: "w-3.5 h-3.5", pad: "px-2.5" },
};
function pickTier(w: number): SizeTier {
  if (w >= 1280) return "lg";
  if (w >= 768) return "md";
  return "sm";
}

interface Props {
  points: SurveyPoint[];
  onHighlight?: (point: SurveyPoint) => void;
  storageKey?: string;
}

/**
 * Floating pill: High / Low / Delta.
 * Locked to bottom-center of the viewport, above the Data/Topo pill row.
 * Tap High or Low to highlight that point.
 */
export function StatsChip({ points, onHighlight }: Props) {
  const stats = useMemo(() => {
    if (points.length === 0) return null;
    let hi = points[0];
    let lo = points[0];
    for (const p of points) {
      if (p.value > hi.value) hi = p;
      if (p.value < lo.value) lo = p;
    }
    return { hi, lo, delta: hi.value - lo.value };
  }, [points]);

  const [tier, setTier] = useState<SizeTier>(() =>
    typeof window === "undefined" ? "sm" : pickTier(window.innerWidth),
  );
  useEffect(() => {
    const onResize = () => setTier(pickTier(window.innerWidth));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  const sz = SIZE_STYLES[tier];

  if (!stats) return null;

  return (
    <div
      className={`fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] ${sz.height} ${sz.text} flex items-stretch rounded-full bg-white/95 backdrop-blur shadow-sm border border-gray-300 overflow-hidden font-medium tabular-nums select-none`}
      aria-label="Elevation stats"
    >
      <button
        type="button"
        className={`${sz.pad} flex items-center gap-0.5 text-gray-700 hover:bg-gray-50`}
        onClick={() => onHighlight?.(stats.hi)}
      >
        <ArrowUp className={`${sz.icon} text-emerald-600`} />
        <span className="font-mono">{stats.hi.value.toFixed(2)}</span>
      </button>
      <button
        type="button"
        className={`${sz.pad} flex items-center gap-0.5 border-l border-gray-200 text-gray-700 hover:bg-gray-50`}
        onClick={() => onHighlight?.(stats.lo)}
      >
        <ArrowDown className={`${sz.icon} text-sky-600`} />
        <span className="font-mono">{stats.lo.value.toFixed(2)}</span>
      </button>
      <div className={`${sz.pad} flex items-center gap-0.5 border-l border-gray-200 text-gray-500`}>
        <span className="font-mono">Δ{stats.delta.toFixed(2)}</span>
      </div>
    </div>
  );
}
