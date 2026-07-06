import { useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";

export interface CanvasTransform {
  scale: number;
  tx: number;
  ty: number;
}

interface Props {
  planDataUrl?: string;
  planWidth?: number;
  planHeight?: number;
  /** Draw on top of the plan, in image coordinates (transform applied) */
  drawOverlay?: (ctx: CanvasRenderingContext2D) => void;
  /** Tap in image coordinates (single-tap, after gestures settle) */
  onTap?: (x: number, y: number) => void;
  /** Optional badge above canvas */
  badge?: React.ReactNode;
  /** Fill space or use fixed height */
  className?: string;
  /** Called on transform change */
  onTransform?: (t: CanvasTransform) => void;
  /** Optional image-space pointer hooks. Return true from down to consume pan/tap. */
  onImagePointerDown?: (x: number, y: number) => boolean;
  onImagePointerMove?: (x: number, y: number) => void;
  onImagePointerUp?: (x: number, y: number) => void;
  /** Plan opacity (only used when planOnTop is false) */
  planOpacity?: number;
  /** Suppress rendering the plan raster (still keeps size) */
  hidePlan?: boolean;
  /** Draw the plan ON TOP of the overlay using multiply blend, so walls stay crisp over color fills */
  planOnTop?: boolean;
}

const IMPLIED_W = 1000;
const IMPLIED_H = 750;

export function PlanCanvas({
  planDataUrl,
  planWidth,
  planHeight,
  drawOverlay,
  onTap,
  badge,
  className,
  onTransform,
  onImagePointerDown,
  onImagePointerMove,
  onImagePointerUp,
  planOpacity = 1,
  hidePlan = false,
  planOnTop = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, tx: 0, ty: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const imgW = planWidth ?? IMPLIED_W;
  const imgH = planHeight ?? IMPLIED_H;

  useEffect(() => {
    if (!planDataUrl) {
      imgRef.current = null;
      setImgLoaded(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = planDataUrl;
  }, [planDataUrl]);

  // Fit-to-view whenever image or wrapper size changes
  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    const s = Math.min(cw / imgW, ch / imgH) * 0.95;
    const tx = (cw - imgW * s) / 2;
    const ty = (ch - imgH * s) / 2;
    const t = { scale: s, tx, ty };
    setTransform(t);
    onTransform?.(t);
  }, [imgW, imgH, onTransform]);

  useEffect(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [fit]);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    // Background
    ctx.fillStyle = "#f7f5f0";
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(transform.tx, transform.ty);
    ctx.scale(transform.scale, transform.scale);

    // Plan bounds
    if (!hidePlan) {
      if (imgLoaded && imgRef.current) {
        ctx.globalAlpha = planOpacity;
        ctx.drawImage(imgRef.current, 0, 0, imgW, imgH);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, imgW, imgH);
        ctx.strokeStyle = "#e5e0d5";
        ctx.lineWidth = 2 / transform.scale;
        ctx.strokeRect(0, 0, imgW, imgH);
      }
    }

    if (drawOverlay) drawOverlay(ctx);
    ctx.restore();
  }, [transform, imgLoaded, imgW, imgH, drawOverlay, planOpacity, hidePlan]);

  useEffect(() => {
    render();
  });

  // --- Pointer / gesture handling ---
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStart = useRef<{
    dist: number;
    mid: { x: number; y: number };
    transform: CanvasTransform;
  } | null>(null);
  const singleStart = useRef<{ x: number; y: number; t0: number; moved: boolean } | null>(null);
  const customPointer = useRef<number | null>(null);

  function toImage(clientX: number, clientY: number) {
    const rect = wrapRef.current!.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const t = transformRef.current;
    return { x: (localX - t.tx) / t.scale, y: (localY - t.ty) / t.scale };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (onImagePointerDown) {
      const img = toImage(e.clientX, e.clientY);
      if (onImagePointerDown(img.x, img.y)) {
        customPointer.current = e.pointerId;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      singleStart.current = { x: e.clientX, y: e.clientY, t0: performance.now(), moved: false };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gestureStart.current = { dist, mid, transform: transformRef.current };
      singleStart.current = null;
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    if (customPointer.current === e.pointerId) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const img = toImage(e.clientX, e.clientY);
      onImagePointerMove?.(img.x, img.y);
      return;
    }
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && gestureStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const g = gestureStart.current;
      const rect = wrapRef.current!.getBoundingClientRect();
      const scale = g.transform.scale * (dist / g.dist);
      // keep the pinch midpoint stationary
      const originalMidLocal = { x: g.mid.x - rect.left, y: g.mid.y - rect.top };
      const newMidLocal = { x: mid.x - rect.left, y: mid.y - rect.top };
      const imgX = (originalMidLocal.x - g.transform.tx) / g.transform.scale;
      const imgY = (originalMidLocal.y - g.transform.ty) / g.transform.scale;
      const tx = newMidLocal.x - imgX * scale;
      const ty = newMidLocal.y - imgY * scale;
      const t = { scale: Math.max(0.05, Math.min(20, scale)), tx, ty };
      setTransform(t);
      onTransform?.(t);
    } else if (pointers.current.size === 1 && singleStart.current) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const total = Math.hypot(e.clientX - singleStart.current.x, e.clientY - singleStart.current.y);
      if (total > 6) singleStart.current.moved = true;
      if (singleStart.current.moved) {
        const t = {
          scale: transformRef.current.scale,
          tx: transformRef.current.tx + dx,
          ty: transformRef.current.ty + dy,
        };
        setTransform(t);
        onTransform?.(t);
      }
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (customPointer.current === e.pointerId) {
      const img = toImage(e.clientX, e.clientY);
      onImagePointerUp?.(img.x, img.y);
      customPointer.current = null;
      pointers.current.delete(e.pointerId);
      singleStart.current = null;
      return;
    }
    const wasSingle = pointers.current.size === 1 && singleStart.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gestureStart.current = null;
    if (wasSingle && singleStart.current && !singleStart.current.moved && onTap) {
      const rect = wrapRef.current!.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const t = transformRef.current;
      const x = (localX - t.tx) / t.scale;
      const y = (localY - t.ty) / t.scale;
      onTap(x, y);
    }
    singleStart.current = null;
  }

  // wheel zoom for desktop
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const rect = wrapRef.current!.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const t = transformRef.current;
    const newScale = Math.max(0.05, Math.min(20, t.scale * factor));
    const imgX = (localX - t.tx) / t.scale;
    const imgY = (localY - t.ty) / t.scale;
    const nt = { scale: newScale, tx: localX - imgX * newScale, ty: localY - imgY * newScale };
    setTransform(nt);
    onTransform?.(nt);
  }

  return (
    <div className={className ?? "relative flex-1 min-h-0"}>
      {badge}
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ cursor: "crosshair" }}
      >
        <canvas ref={canvasRef} />
      </div>
      <button
        onClick={fit}
        className="absolute bottom-3 right-3 rounded-md bg-background/90 border px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-background"
      >
        Fit
      </button>
    </div>
  );
}
