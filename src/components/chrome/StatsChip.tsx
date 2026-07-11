import { useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { SurveyPoint } from "@/lib/types";

interface Props {
  points: SurveyPoint[];
  onHighlight?: (point: SurveyPoint) => void;
}

/**
 * Non-selectable pill tracking High / Low / Delta of current floor points.
 * Tapping High or Low segments highlights that point (via onHighlight).
 * Matches other floating chips: h-9, white/95 bg, gray-300 border, rounded-full.
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

  if (!stats) return null;

  return (
    <div
      className="fixed z-40 top-11 left-1/2 -translate-x-1/2 landscape-short:top-11 h-6 flex items-stretch rounded-full bg-white/95 backdrop-blur shadow-sm border border-gray-300 overflow-hidden text-[10px] font-medium tabular-nums select-none"
      aria-label="Elevation stats"
    >
      <button
        type="button"
        onClick={() => onHighlight?.(stats.hi)}
        className="px-1.5 flex items-center gap-0.5 text-gray-700 hover:bg-gray-50 transition-colors"
        aria-label={`Highlight high point ${stats.hi.value.toFixed(2)}`}
      >
        <ArrowUp className="w-2.5 h-2.5 text-emerald-600" />
        <span className="font-mono">{stats.hi.value.toFixed(2)}</span>
      </button>
      <button
        type="button"
        onClick={() => onHighlight?.(stats.lo)}
        className="px-1.5 flex items-center gap-0.5 border-l border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        aria-label={`Highlight low point ${stats.lo.value.toFixed(2)}`}
      >
        <ArrowDown className="w-2.5 h-2.5 text-sky-600" />
        <span className="font-mono">{stats.lo.value.toFixed(2)}</span>
      </button>
      <div className="px-1.5 flex items-center gap-0.5 border-l border-gray-200 text-gray-500">
        <span className="font-mono">Δ{stats.delta.toFixed(2)}</span>
      </div>
    </div>
  );
}
