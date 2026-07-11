import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import type { SurveyPoint } from "@/lib/types";

interface Props {
  points: SurveyPoint[];
  onHighlight?: (point: SurveyPoint) => void;
  storageKey?: string;
}

/**
 * Draggable floating pill tracking High / Low / Delta of current floor points.
 * Position persists in localStorage. Tapping High or Low highlights that point.
 */
export function StatsChip({ points, onHighlight, storageKey = "stats-chip-pos" }: Props) {
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

  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  });
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number; pointerId: number } | null>(null);

  // Default position: below top bar, centered horizontally.
  useEffect(() => {
    if (pos) return;
    const w = ref.current?.offsetWidth ?? 180;
    setPos({ x: Math.max(8, window.innerWidth / 2 - w / 2), y: 52 });
  }, [pos]);

  // Keep in viewport on resize/rotation.
  useEffect(() => {
    const clamp = () => {
      setPos((p) => {
        if (!p || !ref.current) return p;
        const w = ref.current.offsetWidth;
        const h = ref.current.offsetHeight;
        const x = Math.min(Math.max(4, p.x), window.innerWidth - w - 4);
        const y = Math.min(Math.max(4, p.y), window.innerHeight - h - 4);
        return x === p.x && y === p.y ? p : { x, y };
      });
    };
    window.addEventListener("resize", clamp);
    window.addEventListener("orientationchange", clamp);
    return () => {
      window.removeEventListener("resize", clamp);
      window.removeEventListener("orientationchange", clamp);
    };
  }, []);

  const savePos = (p: { x: number; y: number }) => {
    try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch { /* ignore */ }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, pointerId: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const w = ref.current?.offsetWidth ?? 0;
    const h = ref.current?.offsetHeight ?? 0;
    const x = Math.min(Math.max(4, e.clientX - dragRef.current.dx), window.innerWidth - w - 4);
    const y = Math.min(Math.max(4, e.clientY - dragRef.current.dy), window.innerHeight - h - 4);
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (pos) savePos(pos);
  };

  if (!stats || !pos) {
    return (
      <div ref={ref} className="fixed opacity-0 pointer-events-none" style={{ left: -9999, top: -9999 }} />
    );
  }

  return (
    <div
      ref={ref}
      className="fixed z-40 h-6 flex items-stretch rounded-full bg-white/95 backdrop-blur shadow-sm border border-gray-300 overflow-hidden text-[10px] font-medium tabular-nums select-none touch-none"
      style={{ left: pos.x, top: pos.y }}
      aria-label="Elevation stats"
    >
      <div
        className="px-1 flex items-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Drag stats"
      >
        <GripVertical className="w-2.5 h-2.5" />
      </div>
      <button
        type="button"
        onClick={() => onHighlight?.(stats.hi)}
        className="px-1.5 flex items-center gap-0.5 border-l border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
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
