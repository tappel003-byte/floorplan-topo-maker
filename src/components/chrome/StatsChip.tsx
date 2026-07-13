import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { SurveyPoint } from "@/lib/types";

interface Props {
  points: SurveyPoint[];
  onHighlight?: (point: SurveyPoint) => void;
  storageKey?: string;
}

/** Height in px of the top chrome (header + optional floor selector) plus a gap. */
function topChromeHeight() {
  const header = document.querySelector("header");
  const selector = document.querySelector("[data-floor-selector]");
  const h = (header?.getBoundingClientRect().height ?? 0) + (selector?.getBoundingClientRect().height ?? 0);
  return h + 4; // 4px gap below chrome
}

/**
 * Floating pill: High / Low / Delta.
 * - Drag anywhere on the chip to move it (5px threshold).
 * - Quick tap on High/Low = highlight that point.
 * - Position persists per storageKey and clamps to viewport on resize/rotate.
 *   Top edge is clamped below the live header/floor selector so the pill can never
 *   hide under the chrome in portrait or landscape.
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

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  });

  // Default: bottom center, above the bottom pill row. Persisted position wins.
  useEffect(() => {
    if (pos) return;
    const w = ref.current?.offsetWidth ?? 180;
    const h = ref.current?.offsetHeight ?? 24;
    const top = topChromeHeight();
    setPos({
      x: Math.max(8, window.innerWidth / 2 - w / 2),
      y: Math.max(top, window.innerHeight - h - 80),
    });
  }, [pos]);

  // Clamp on resize / rotation.
  useEffect(() => {
    const clamp = () => {
      setPos((p) => {
        if (!p || !ref.current) return p;
        const w = ref.current.offsetWidth;
        const h = ref.current.offsetHeight;
        const top = topChromeHeight();
        const x = Math.min(Math.max(4, p.x), window.innerWidth - w - 4);
        const y = Math.min(Math.max(top, p.y), window.innerHeight - h - 60);
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

  const drag = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      pointerId: e.pointerId,
      moved: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    const w = ref.current?.offsetWidth ?? 0;
    const h = ref.current?.offsetHeight ?? 0;
    const top = topChromeHeight();
    const x = Math.min(Math.max(4, d.originX + dx), window.innerWidth - w - 4);
    const y = Math.min(Math.max(top, d.originY + dy), window.innerHeight - h - 4);
    setPos({ x, y });
  };
  const endDrag = (e: React.PointerEvent, target?: "hi" | "lo") => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch { /* ignore */ }
      return;
    }
    if (target && stats) onHighlight?.(target === "hi" ? stats.hi : stats.lo);
  };

  if (!stats || !pos) {
    return <div ref={ref} className="fixed pointer-events-none opacity-0" style={{ left: -9999, top: -9999 }} />;
  }

  return (
    <div
      ref={ref}
      className="fixed z-40 h-6 flex items-stretch rounded-full bg-white/95 backdrop-blur shadow-sm border border-gray-300 overflow-hidden text-[10px] font-medium tabular-nums select-none touch-none cursor-grab active:cursor-grabbing"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e)}
      onPointerCancel={(e) => endDrag(e)}
      aria-label="Elevation stats — drag to move"
    >
      <div
        className="px-1.5 flex items-center gap-0.5 text-gray-700"
        onPointerUp={(e) => endDrag(e, "hi")}
      >
        <ArrowUp className="w-2.5 h-2.5 text-emerald-600" />
        <span className="font-mono">{stats.hi.value.toFixed(2)}</span>
      </div>
      <div
        className="px-1.5 flex items-center gap-0.5 border-l border-gray-200 text-gray-700"
        onPointerUp={(e) => endDrag(e, "lo")}
      >
        <ArrowDown className="w-2.5 h-2.5 text-sky-600" />
        <span className="font-mono">{stats.lo.value.toFixed(2)}</span>
      </div>
      <div className="px-1.5 flex items-center gap-0.5 border-l border-gray-200 text-gray-500">
        <span className="font-mono">Δ{stats.delta.toFixed(2)}</span>
      </div>
    </div>
  );
}
