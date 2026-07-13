import { useEffect, useMemo, useRef, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Undo2, X, Waves, Palette, Tag, SlidersHorizontal } from "lucide-react";
import type { Floor, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { TopoDiagnosticPanel } from "../TopoDiagnosticPanel";
import {
  TOPO_GRID_TARGET_COLS,
  buildGrid,
  clampValue,
  computeContours,
  contourThresholds,
  type Grid,
} from "@/lib/topo";
import { savePoint, saveFloor } from "@/lib/db";

interface Props {
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  onFloorChange: (floor: Floor) => void;
  settings: RenderSettings;
  onSettingsChange: (s: RenderSettings) => void;
  selectedIds?: Set<string>;
  pointSize?: number;
  excludedIds?: Set<string>;
  onExcludedIdsChange?: (ids: Set<string>) => void;
}

const DEFAULT_LABEL_DX = 8;
const DEFAULT_LABEL_DY = 6;
const LONG_PRESS_MS = 350;

// Pin geometry — matches drawPin(). Pin box is centered horizontally on the
// point, sitting above it. These constants keep hit-testing and rendering aligned.
const PIN_H = 20;
const PIN_TOP_OFFSET = -28; // top of pin relative to point y
const PIN_MIN_W = 40; // widened for "High"/"Low" text

// Offscreen ctx for text width measurement in event handlers
let measureCtx: CanvasRenderingContext2D | null = null;
function measureLabel(text: string, fontPx: number, weight: string) {
  if (!measureCtx) {
    const c = document.createElement("canvas");
    measureCtx = c.getContext("2d");
  }
  if (!measureCtx) return { w: text.length * fontPx * 0.6, h: fontPx };
  measureCtx.font = `${weight} ${fontPx}px sans-serif`;
  return { w: measureCtx.measureText(text).width, h: fontPx };
}

function pinWidth(text: string) {
  const { w } = measureLabel(text, 11, "bold");
  return Math.max(PIN_MIN_W, w + 14);
}

// Where the label sits (top-left corner) for a given point in image coords.
function labelAnchor(p: SurveyPoint) {
  return {
    x: p.x + (p.labelDx ?? DEFAULT_LABEL_DX),
    y: p.y + (p.labelDy ?? DEFAULT_LABEL_DY),
  };
}

export function TopoTab({
  floor,
  points,
  onPointsChange,
  onFloorChange,
  settings,
  onSettingsChange,
  selectedIds,
  pointSize = 6,
  excludedIds: excludedIdsProp,
  onExcludedIdsChange,
}: Props) {
  const selectedId =
    selectedIds && selectedIds.size > 0 ? (selectedIds.values().next().value ?? null) : null;
  const [openCorner, setOpenCorner] = useState<null | "contours" | "palette" | "labels">(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [legendDrag, setLegendDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [legendSelected, setLegendSelected] = useState(false);
  const resolved = resolveSettings(settings);

  // Persist legend scale/position across sessions (localStorage). Defaults: 1.5×.
  const LEGEND_STORAGE_KEY = "topo.legend.v1";
  const legendHydratedRef = useRef(false);
  useEffect(() => {
    if (legendHydratedRef.current) return;
    legendHydratedRef.current = true;
    if (typeof window === "undefined") return;
    let stored: { scale?: number; x?: number; y?: number } | null = null;
    try {
      const raw = window.localStorage.getItem(LEGEND_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = null;
    }
    const patch: Partial<RenderSettings> = {};
    if (stored && typeof stored.scale === "number") patch.legendScale = stored.scale;
    else patch.legendScale = 1.5;
    if (stored && typeof stored.x === "number") patch.legendX = stored.x;
    if (stored && typeof stored.y === "number") patch.legendY = stored.y;
    onSettingsChange(resolveSettings({ ...resolved, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!legendHydratedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LEGEND_STORAGE_KEY,
        JSON.stringify({
          scale: resolved.legendScale ?? 1.5,
          x: resolved.legendX,
          y: resolved.legendY,
        }),
      );
    } catch {
      /* ignore quota */
    }
  }, [resolved.legendScale, resolved.legendX, resolved.legendY]);


  // Live drag (long-press-and-drag). One kind at a time: a point label or a H/L pin.
  type DragKind = "label" | "pin-high" | "pin-low";
  const [drag, setDrag] = useState<{
    kind: DragKind;
    id: string; // point id for "label", floor id for pins
    dx: number;
    dy: number;
    startPointerX: number;
    startPointerY: number;
    startDx: number;
    startDy: number;
    active: boolean; // true after long-press fires
  } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  type LastMove =
    | { kind: "label"; id: string; prevDx: number | undefined; prevDy: number | undefined }
    | { kind: "pin-high" | "pin-low"; prevDx: number | undefined; prevDy: number | undefined };
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  // Diagnostic exclusion (Topo-only, session-only). Removed points do NOT
  // affect stored data — they're just skipped by the contour math on this tab.
  // Controlled from the route when props are provided so StatsChip can share the set.
  const [excludedIdsLocal, setExcludedIdsLocal] = useState<Set<string>>(() => new Set());
  const excludedIds = excludedIdsProp ?? excludedIdsLocal;
  const setExcludedIds = (ids: Set<string>) => {
    if (onExcludedIdsChange) onExcludedIdsChange(ids);
    else setExcludedIdsLocal(ids);
  };
  const [diagOpen, setDiagOpen] = useState(false);
  useEffect(() => {
    if (onExcludedIdsChange) onExcludedIdsChange(new Set());
    else setExcludedIdsLocal(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id]);

  const visiblePoints = useMemo(
    () => (excludedIds.size ? points.filter((p) => !excludedIds.has(p.id)) : points),
    [points, excludedIds],
  );

  const canRender = visiblePoints.length >= 3 && floor.boundary.length >= 3;

  const gridAndContours = useMemo(() => {
    if (!canRender) return null;
    const grid = buildGrid(visiblePoints, floor.boundary, TOPO_GRID_TARGET_COLS);
    if (!grid) return null;
    const cs = computeContours(grid, contourOptions(grid, resolved));
    return { grid, contours: cs };
  }, [
    canRender,
    visiblePoints,
    floor.boundary,
    resolved.firstContour,
    resolved.contourStep,
    resolved.contourCount,
    resolved.minClamp,
    resolved.maxClamp,
  ]);

  const update = (patch: Partial<RenderSettings>) =>
    onSettingsChange(resolveSettings({ ...resolved, ...patch }));

  // Compute current High / Low points (matches renderTopoTop logic).
  const hiLo = useMemo(() => {
    if (!visiblePoints.length) return null;
    let hi = visiblePoints[0],
      lo = visiblePoints[0];
    for (const p of visiblePoints) {
      if (p.value > hi.value) hi = p;
      if (p.value < lo.value) lo = p;
    }
    return { hi, lo };
  }, [visiblePoints]);



  type Hit =
    | { kind: "label"; point: SurveyPoint }
    | { kind: "pin-high" | "pin-low"; point: SurveyPoint; dx: number; dy: number };

  function hitDraggable(x: number, y: number): Hit | null {
    // Pins first — they sit above the point dot and are visually on top.
    if (resolved.showHighLow && hiLo && gridAndContours?.grid && resolved.mode !== "points-only") {
      const check = (kind: "pin-high" | "pin-low", pt: SurveyPoint, dx: number, dy: number) => {
        const w = pinWidth(kind === "pin-high" ? "High" : "Low");
        const cx = pt.x + dx;
        const top = pt.y + PIN_TOP_OFFSET + dy;
        return x >= cx - w / 2 && x <= cx + w / 2 && y >= top && y <= top + PIN_H;
      };
      const hDx = floor.highPinDx ?? 0;
      const hDy = floor.highPinDy ?? 0;
      const lDx = floor.lowPinDx ?? 0;
      const lDy = floor.lowPinDy ?? 0;
      if (check("pin-high", hiLo.hi, hDx, hDy))
        return { kind: "pin-high", point: hiLo.hi, dx: hDx, dy: hDy };
      if (check("pin-low", hiLo.lo, lDx, lDy))
        return { kind: "pin-low", point: hiLo.lo, dx: lDx, dy: lDy };
    }
    // Point-number labels
    if (resolved.showPoints) {
      const dec = resolved.decimalPlaces;
      const fontPx = resolved.pointLabelFontSize;
      const weight = resolved.pointLabelWeight;
      const pad = 4;
      for (const p of visiblePoints) {
        const text = p.value.toFixed(dec);
        const { w, h } = measureLabel(text, fontPx, weight);
        const a = labelAnchor(p);
        if (x >= a.x - pad && x <= a.x + w + pad && y >= a.y - pad && y <= a.y + h + pad) {
          return { kind: "label", point: p };
        }
      }
    }
    return null;
  }

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function commitLabelMove(id: string, dx: number, dy: number) {
    const p = points.find((pt) => pt.id === id);
    if (!p) return;
    setLastMove({ kind: "label", id, prevDx: p.labelDx, prevDy: p.labelDy });
    const updated: SurveyPoint = { ...p, labelDx: dx, labelDy: dy };
    onPointsChange(points.map((pt) => (pt.id === id ? updated : pt)));
    savePoint(updated).catch(() => {});
  }

  function commitPinMove(kind: "pin-high" | "pin-low", dx: number, dy: number) {
    const prevDx = kind === "pin-high" ? floor.highPinDx : floor.lowPinDx;
    const prevDy = kind === "pin-high" ? floor.highPinDy : floor.lowPinDy;
    setLastMove({ kind, prevDx, prevDy });
    const updated: Floor =
      kind === "pin-high"
        ? { ...floor, highPinDx: dx, highPinDy: dy }
        : { ...floor, lowPinDx: dx, lowPinDy: dy };
    onFloorChange(updated);
    saveFloor(updated).catch(() => {});
  }

  function undoLastMove() {
    if (!lastMove) return;
    if (lastMove.kind === "label") {
      const p = points.find((pt) => pt.id === lastMove.id);
      if (!p) {
        setLastMove(null);
        return;
      }
      const updated: SurveyPoint = { ...p, labelDx: lastMove.prevDx, labelDy: lastMove.prevDy };
      onPointsChange(points.map((pt) => (pt.id === lastMove.id ? updated : pt)));
      savePoint(updated).catch(() => {});
    } else {
      const updated: Floor =
        lastMove.kind === "pin-high"
          ? { ...floor, highPinDx: lastMove.prevDx, highPinDy: lastMove.prevDy }
          : { ...floor, lowPinDx: lastMove.prevDx, lowPinDy: lastMove.prevDy };
      onFloorChange(updated);
      saveFloor(updated).catch(() => {});
    }
    setLastMove(null);
  }

  function resetAllLabelPositions() {
    const updates = points
      .filter((p) => p.labelDx !== undefined || p.labelDy !== undefined)
      .map((p) => ({ ...p, labelDx: undefined, labelDy: undefined }));
    if (updates.length) {
      const map = new Map(updates.map((u) => [u.id, u]));
      onPointsChange(points.map((p) => map.get(p.id) ?? p));
      updates.forEach((u) => savePoint(u).catch(() => {}));
    }
    // Also clear pin offsets on this floor.
    if (
      floor.highPinDx !== undefined ||
      floor.highPinDy !== undefined ||
      floor.lowPinDx !== undefined ||
      floor.lowPinDy !== undefined
    ) {
      const cleared: Floor = {
        ...floor,
        highPinDx: undefined,
        highPinDy: undefined,
        lowPinDx: undefined,
        lowPinDy: undefined,
      };
      onFloorChange(cleared);
      saveFloor(cleared).catch(() => {});
    }
    setLastMove(null);
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Corner icons — closed by default, tap to open. Hidden while their own panel is open. */}
      {openCorner !== "contours" && (
        <CornerIcon
          pos="top-2 left-2 landscape-short:top-auto landscape-short:left-1/2 landscape-short:-translate-x-[calc(100%+0.25rem)] landscape-short:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]"
          active={false}
          onClick={() => setOpenCorner("contours")}
          label="Contours"
        >
          <Waves className="h-4 w-4" />
        </CornerIcon>
      )}
      {openCorner !== "palette" && (
        <CornerIcon
          pos="top-2 right-2 landscape-short:top-auto landscape-short:right-auto landscape-short:left-1/2 landscape-short:translate-x-[0.25rem] landscape-short:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]"
          active={false}
          onClick={() => setOpenCorner("palette")}
          label="Palette"
        >
          <Palette className="h-4 w-4" />
        </CornerIcon>
      )}
      {openCorner !== "labels" && (
        <button
          type="button"
          onClick={() => setOpenCorner("labels")}
          aria-label="Labels & layers"
          className="fixed z-30 h-9 w-9 rounded-full bg-white/95 backdrop-blur border border-gray-300 shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-[calc(env(safe-area-inset-right)+0.75rem)]"
        >
          <Tag className="h-4 w-4" />
        </button>
      )}
      {/* Diagnostic panel toggle — Topo-only. Excludes points from contour math without touching stored data. */}
      <button
        type="button"
        onClick={() => setDiagOpen((v) => !v)}
        aria-label="Diagnostic points panel"
        className={
          "fixed z-30 h-9 min-w-9 px-2 rounded-full backdrop-blur border shadow-md flex items-center justify-center gap-1 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-[calc(env(safe-area-inset-right)+3.5rem)] " +
          (diagOpen || excludedIds.size > 0
            ? "bg-amber-100 border-amber-300 text-amber-900"
            : "bg-white/95 border-gray-300 text-gray-700 hover:bg-gray-50")
        }
      >
        <SlidersHorizontal className="h-4 w-4" />
        {excludedIds.size > 0 && (
          <span className="text-[10px] font-mono tabular-nums">{excludedIds.size}</span>
        )}
      </button>

      {diagOpen && (
        <TopoDiagnosticPanel
          points={points}
          excludedIds={excludedIds}
          onToggleExclude={(id) => {
            const next = new Set(excludedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setExcludedIds(next);
          }}
          onRestoreAll={() => setExcludedIds(new Set())}
          onClose={() => setDiagOpen(false)}
        />
      )}

      {/* Warning */}
      {!canRender && !warningDismissed && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 rounded-lg bg-amber-50/95 backdrop-blur border border-amber-200 text-amber-900 text-xs px-3 py-2 shadow-sm flex items-start gap-2 max-w-[calc(100%-6rem)]">
          <span className="flex-1">
            Need at least 3 points and a closed boundary to generate a topo.
          </span>
          <button
            onClick={() => setWarningDismissed(true)}
            aria-label="Dismiss"
            className="text-amber-700 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Legend size (appears when the legend is tapped) */}
      {legendSelected &&
        resolved.showLegend &&
        gridAndContours?.grid &&
        resolved.mode !== "points-only" && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 rounded-lg bg-background/95 backdrop-blur border shadow-md px-3 py-2 w-56 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Legend size</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {(resolved.legendScale ?? 1).toFixed(2)}×
                </span>
                <button
                  onClick={() => setLegendSelected(false)}
                  aria-label="Close"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <Slider
              min={0.4}
              max={4}
              step={0.05}
              value={[resolved.legendScale ?? 1]}
              onValueChange={([v]) => update({ legendScale: v })}
            />
            <p className="text-[10px] text-muted-foreground">Drag the legend to move it.</p>
          </div>
        )}

      <div className="flex-1 relative min-h-0 flex flex-col">
        <PlanCanvas
          planDataUrl={floor.planDataUrl}
          planWidth={floor.planWidth}
          planHeight={floor.planHeight}
          hidePlan={!resolved.showPlan}
          planOnTop
          onImagePointerDown={(x, y) => {
            // Legend tap: select + start drag. No corner-resize; size is edited via the floating slider.
            if (resolved.showLegend && gridAndContours?.grid && resolved.mode !== "points-only") {
              const box = legendBox(resolved);
              const inBox = x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
              if (inBox) {
                setLegendSelected(true);
                setLegendDrag({ dx: x - box.x, dy: y - box.y });
                return true;
              }
            }
            // Tap elsewhere on the canvas deselects the legend.
            if (legendSelected) setLegendSelected(false);
            // Long-press on a label or a H/L pin to pick it up
            const hit = hitDraggable(x, y);
            if (hit) {
              const startDx =
                hit.kind === "label" ? (hit.point.labelDx ?? DEFAULT_LABEL_DX) : hit.dx;
              const startDy =
                hit.kind === "label" ? (hit.point.labelDy ?? DEFAULT_LABEL_DY) : hit.dy;
              setDrag({
                kind: hit.kind,
                id: hit.kind === "label" ? hit.point.id : floor.id,
                dx: startDx,
                dy: startDy,
                startPointerX: x,
                startPointerY: y,
                startDx,
                startDy,
                active: false,
              });
              clearLongPress();
              longPressTimer.current = window.setTimeout(() => {
                setDrag((d) => (d ? { ...d, active: true } : d));
              }, LONG_PRESS_MS);
              return true;
            }
            return false;
          }}
          onImagePointerMove={(x, y) => {
            if (legendDrag) {
              update({
                legendX: Math.max(0, x - legendDrag.dx),
                legendY: Math.max(0, y - legendDrag.dy),
              });
              return;
            }
            if (drag) {
              if (!drag.active) {
                const moved = Math.hypot(x - drag.startPointerX, y - drag.startPointerY);
                if (moved > 6) {
                  clearLongPress();
                  setDrag(null);
                }
                return;
              }
              setDrag({
                ...drag,
                dx: drag.startDx + (x - drag.startPointerX),
                dy: drag.startDy + (y - drag.startPointerY),
              });
            }
          }}
          onImagePointerUp={() => {
            setLegendDrag(null);
            setLegendDrag(null);
            clearLongPress();
            if (drag && drag.active) {
              const moved = drag.dx !== drag.startDx || drag.dy !== drag.startDy;
              if (moved) {
                if (drag.kind === "label") commitLabelMove(drag.id, drag.dx, drag.dy);
                else commitPinMove(drag.kind, drag.dx, drag.dy);
              }
            }
            setDrag(null);
          }}
          drawOverlay={(ctx) => {
            renderTopoBase(ctx, floor, resolved, gridAndContours);
          }}
          drawOverlayTop={(ctx) => {
            const activeLabel =
              drag && drag.active && drag.kind === "label"
                ? { id: drag.id, dx: drag.dx, dy: drag.dy }
                : null;
            const activePinHigh =
              drag && drag.active && drag.kind === "pin-high" ? { dx: drag.dx, dy: drag.dy } : null;
            const activePinLow =
              drag && drag.active && drag.kind === "pin-low" ? { dx: drag.dx, dy: drag.dy } : null;
            renderTopoTop(ctx, floor, visiblePoints, resolved, gridAndContours, {
              liveDrag: activeLabel,
              highlightId: activeLabel?.id ?? selectedId,
              livePinHigh: activePinHigh,
              livePinLow: activePinLow,
              highlightPin: drag?.active && drag.kind !== "label" ? drag.kind : null,
              legendSelected,
              pointSize,
            });
          }}
        />

        {/* Contours popover — upper left */}
        {openCorner === "contours" && (
          <CornerPanel pos="top-12 left-2 landscape-short:top-2 landscape-short:left-auto landscape-short:right-2" onClose={() => setOpenCorner(null)} title="Contours">
            {gridAndContours?.grid && (
              <p className="text-[10px] text-muted-foreground tabular-nums -mt-1">
                Range {gridAndContours.grid.minValue.toFixed(2)}"–
                {gridAndContours.grid.maxValue.toFixed(2)}"
              </p>
            )}
            <div>
              <Label className="text-xs">Mode</Label>
              <select
                value={resolved.mode}
                onChange={(e) => update({ mode: e.target.value as RenderSettings["mode"] })}
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
              >
                <option value="contour-fill">Color fill</option>
                <option value="contour-cells">Color cells</option>
                <option value="contour-bw">B&W lines</option>
                <option value="points-only">Points only</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">First</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={resolved.firstContour ?? ""}
                  placeholder="auto"
                  onChange={(e) =>
                    update({
                      firstContour: e.target.value === "" ? null : parseFloat(e.target.value),
                    })
                  }
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Step</Label>
                <StepInput
                  value={resolved.contourStep}
                  onCommit={(step) => update({ contourStep: step, interval: step })}
                />
              </div>
              <div>
                <Label className="text-xs">Count</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={resolved.contourCount ?? ""}
                  placeholder="auto"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "" || raw.toLowerCase() === "auto") {
                      update({ contourCount: null });
                    } else {
                      const n = parseInt(raw, 10);
                      update({ contourCount: isFinite(n) ? Math.max(2, n) : null });
                    }
                  }}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Line thickness</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {resolved.lineThickness.toFixed(1)}
                </span>
              </div>
              <Slider
                min={0.5}
                max={4}
                step={0.1}
                value={[resolved.lineThickness]}
                onValueChange={(v) => update({ lineThickness: v[0] })}
                className="mt-2"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Contours on</Label>
              <Switch
                checked={resolved.showContours}
                onCheckedChange={(v) => update({ showContours: v })}
              />
            </div>
          </CornerPanel>
        )}

        {/* Palette popover — upper right */}
        {openCorner === "palette" && (
          <CornerPanel
            pos="top-12 right-2 w-60 landscape-short:top-2"
            onClose={() => setOpenCorner(null)}
            title="Palette"
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs">Reverse</Label>
              <Switch
                checked={resolved.reversePalette}
                onCheckedChange={(v) => update({ reversePalette: v })}
              />
            </div>
            <PalettePicker
              value={resolved.palette}
              onChange={(p) => update({ palette: p })}
            />
          </CornerPanel>
        )}

        {/* Labels & layers popover — lower right */}
        {openCorner === "labels" && (
          <CornerPanel
            pos="bottom-14 right-3"
            onClose={() => setOpenCorner(null)}
            title="Labels & layers"
          >
            <div className="grid grid-cols-2 gap-2">
              <SwitchRow
                label="Labels"
                checked={resolved.showLabels}
                onChange={(v) => update({ showLabels: v })}
              />
              <NumberControl
                label="Decimals"
                value={resolved.decimalPlaces}
                min={0}
                max={3}
                step={1}
                onChange={(v) =>
                  update({ decimalPlaces: Math.max(0, Math.min(3, Math.round(v ?? 2))) })
                }
              />
              <SwitchRow
                label="Floor plan"
                checked={resolved.showPlan}
                onChange={(v) => update({ showPlan: v })}
              />
              <SwitchRow
                label="Points"
                checked={resolved.showPoints}
                onChange={(v) => update({ showPoints: v, pointsOpacity: 1 })}
              />
              <SwitchRow
                label="Legend"
                checked={resolved.showLegend}
                onChange={(v) => update({ showLegend: v })}
              />
              <SwitchRow
                label="High / low"
                checked={resolved.showHighLow}
                onChange={(v) => update({ showHighLow: v })}
              />
              <SwitchRow
                label="Label bg"
                checked={resolved.pointLabelBackground === "white"}
                onChange={(v) => update({ pointLabelBackground: v ? "white" : "transparent" })}
              />
            </div>
            <details className="border-t pt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">
                Label style
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <NumberControl
                  label="Font size"
                  value={resolved.pointLabelFontSize}
                  min={7}
                  max={28}
                  step={1}
                  onChange={(v) =>
                    update({ pointLabelFontSize: Math.max(7, Math.min(28, Math.round(v ?? 11))) })
                  }
                />
                <div>
                  <Label className="text-xs">Weight</Label>
                  <select
                    value={resolved.pointLabelWeight}
                    onChange={(e) =>
                      update({ pointLabelWeight: e.target.value as "normal" | "bold" })
                    }
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Color</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={resolved.pointLabelColor}
                      onChange={(e) => update({ pointLabelColor: e.target.value })}
                      className="h-9 w-12 rounded-md border bg-background p-1 cursor-pointer"
                    />
                    <Input
                      value={resolved.pointLabelColor}
                      onChange={(e) => update({ pointLabelColor: e.target.value })}
                      className="h-9 flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={resetAllLabelPositions}
                className="mt-2 w-full h-8"
              >
                Reset label positions
              </Button>
            </details>
          </CornerPanel>
        )}
      </div>
    </div>
  );
}

function CornerIcon({
  pos,
  active,
  onClick,
  label,
  children,
}: {
  pos: string;
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={
        "absolute z-30 h-9 w-9 rounded-full backdrop-blur border shadow-sm flex items-center justify-center " +
        pos +
        " " +
        (active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background/90 hover:bg-background")
      }
    >
      {children}
    </button>
  );
}

function CornerPanel({
  pos,
  title,
  onClose,
  children,
}: {
  pos: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "absolute z-30 rounded-xl border bg-card/95 backdrop-blur shadow-2xl p-3 w-64 max-h-[calc(100%-4rem)] overflow-auto space-y-3 text-sm " +
        pos
      }
    >
      <div className="flex items-center justify-between -mt-1">
        <span className="text-xs font-semibold">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Free-form step input. Keeps local text state so partial input like "." or
// "0." doesn't clobber the committed value mid-typing.
function StepInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const lastValueRef = useRef(value);
  // Sync external changes (e.g. Reset) into the text field
  if (value !== lastValueRef.current && String(value) !== text) {
    lastValueRef.current = value;
    // schedule via microtask isn't safe here — set directly
    setText(String(value));
  }
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        // Only commit when it parses to a positive finite number.
        const n = parseFloat(raw);
        if (Number.isFinite(n) && n > 0) onCommit(n);
      }}
      onBlur={() => {
        const n = parseFloat(text);
        if (!Number.isFinite(n) || n <= 0) {
          setText(String(value));
        } else {
          setText(String(n));
        }
      }}
      className="w-20 h-10"
    />
  );
}

function NumberControl({
  label,
  value,
  placeholder,
  min,
  max,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        className="mt-1 h-9"
      />
    </div>
  );
}

// Exported so ExportTab can reuse the exact rendering pipeline.
export function renderTopo(
  ctx: CanvasRenderingContext2D,
  floor: Floor,
  points: SurveyPoint[],
  settings: RenderSettings,
  gridAndContours: {
    grid: Grid;
    contours: ReturnType<typeof computeContours>;
  } | null,
) {
  renderTopoBase(ctx, floor, settings, gridAndContours);
  renderTopoTop(ctx, floor, points, settings, gridAndContours);
}

// Base pass: contour fills / lines / boundary. Meant to sit UNDER the wall plan.
function renderTopoBase(
  ctx: CanvasRenderingContext2D,
  floor: Floor,
  settings: RenderSettings,
  gridAndContours: {
    grid: Grid;
    contours: ReturnType<typeof computeContours>;
  } | null,
) {
  const resolved = resolveSettings(settings);
  const g = gridAndContours?.grid ?? null;
  const paletteMin = resolved.minClamp ?? g?.minValue ?? 0;
  const paletteMax = resolved.maxClamp ?? g?.maxValue ?? 1;

  if (floor.boundary.length >= 3) {
    ctx.save();
    ctx.beginPath();
    floor.boundary.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();

    if (g && resolved.showContours && resolved.mode === "contour-cells") {
      for (let r = 0; r < g.height; r++) {
        for (let c = 0; c < g.width; c++) {
          const idx = r * g.width + c;
          if (!g.mask[idx]) continue;
          const t = clampValue(g.values[idx], paletteMin, paletteMax);
          ctx.fillStyle = paletteColor(t, resolved.palette, resolved.reversePalette);
          ctx.globalAlpha = resolved.contourOpacity;
          ctx.fillRect(g.x0 + c * g.step, g.y0 + r * g.step, g.step + 0.5, g.step + 0.5);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Contour polygons
    const cs = gridAndContours?.contours;
    if (
      cs &&
      g &&
      resolved.showContours &&
      resolved.mode !== "points-only" &&
      resolved.mode !== "contour-cells"
    ) {
      ctx.save();
      if (resolved.mode === "contour-fill") {
        const minColorT = clampValue(paletteMin, paletteMin, paletteMax);
        ctx.fillStyle = paletteColor(minColorT, resolved.palette, resolved.reversePalette);
        ctx.globalAlpha = 0.7 * resolved.contourOpacity;
        ctx.fillRect(g.x0, g.y0, g.width * g.step, g.height * g.step);
        ctx.globalAlpha = 1;
      }
      ctx.translate(g.x0, g.y0);
      ctx.scale(g.step, g.step);
      for (const c of cs) {
        ctx.beginPath();
        for (const poly of c.coordinates) {
          for (const ring of poly) {
            ring.forEach((pt, i) =>
              i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1]),
            );
            ctx.closePath();
          }
        }
        if (resolved.mode === "contour-fill") {
          const t = clampValue(c.value, paletteMin, paletteMax);
          ctx.fillStyle = paletteColor(t, resolved.palette, resolved.reversePalette);
          ctx.globalAlpha = 0.7 * resolved.contourOpacity;
          ctx.fill();
          ctx.globalAlpha = resolved.contourOpacity;
          ctx.strokeStyle = "rgba(35,24,14,0.58)";
          ctx.lineWidth = resolved.lineThickness / g.step;
          ctx.stroke();
        } else {
          // contour-bw
          const step = Math.max(0.01, resolved.contourStep);
          const isMajor = Math.abs(c.value / (step * 5) - Math.round(c.value / (step * 5))) < 0.03;
          ctx.strokeStyle = "#17130e";
          ctx.lineWidth = (isMajor ? resolved.lineThickness * 2 : resolved.lineThickness) / g.step;
          ctx.globalAlpha = resolved.contourOpacity;
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

}

// Top pass: points, point labels, high/low pins, legend. Meant to sit OVER the wall plan.
function renderTopoTop(
  ctx: CanvasRenderingContext2D,
  floor: Floor,
  points: SurveyPoint[],
  settings: RenderSettings,
  gridAndContours: {
    grid: Grid;
    contours: ReturnType<typeof computeContours>;
  } | null,
  overlay?: {
    liveDrag?: { id: string; dx: number; dy: number } | null;
    highlightId?: string | null;
    livePinHigh?: { dx: number; dy: number } | null;
    livePinLow?: { dx: number; dy: number } | null;
    highlightPin?: "pin-high" | "pin-low" | null;
    legendSelected?: boolean;
    pointSize?: number;
  },
) {
  const resolved = resolveSettings(settings);
  const g = gridAndContours?.grid ?? null;
  const live = overlay?.liveDrag ?? null;
  const highlightId = overlay?.highlightId ?? null;
  const livePinHigh = overlay?.livePinHigh ?? null;
  const livePinLow = overlay?.livePinLow ?? null;
  const highlightPin = overlay?.highlightPin ?? null;
  const fontPx = resolved.pointLabelFontSize;
  const weight = resolved.pointLabelWeight;
  const color = resolved.pointLabelColor;

  if (resolved.showPoints) {
    ctx.globalAlpha = resolved.pointsOpacity;
    const dotR = Math.max(1, overlay?.pointSize ?? 6);
    for (const p of points) {
      // dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = p.isBasePoint ? "#16834a" : "#17130e";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (highlightId === p.id) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "hsl(var(--primary))";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // label
      const text = p.value.toFixed(resolved.decimalPlaces);
      ctx.font = `${weight} ${fontPx}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const isLive = live && live.id === p.id;
      const dx = isLive ? live!.dx : (p.labelDx ?? DEFAULT_LABEL_DX);
      const dy = isLive ? live!.dy : (p.labelDy ?? DEFAULT_LABEL_DY);
      const tx = p.x + dx;
      const ty = p.y + dy;
      const tw = ctx.measureText(text).width;
      const inverted = highlightId === p.id;
      const padX = 6;
      const padY = 3;
      const pillW = tw + padX * 2;
      const pillH = fontPx + padY * 2;
      const cx = tx + tw / 2;
      const cy = ty + fontPx / 2;

      if (inverted) {
        // Inverted highlight: dark pill, light text
        ctx.fillStyle = color;
        roundRectPath(ctx, tx - padX, ty - padY, pillW, pillH, 3);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, cx, cy);
      } else {
        if (resolved.pointLabelBackground === "white") {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          roundRectPath(ctx, tx - padX, ty - padY, pillW, pillH, 3);
          ctx.fill();
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        roundRectPath(ctx, tx - padX, ty - padY, pillW, pillH, 3);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(text, cx, cy);
      }
    }
    ctx.globalAlpha = 1;
  } else if (highlightId) {
    const sel = points.find((p) => p.id === highlightId);
    if (sel) {
      ctx.beginPath();
      ctx.arc(sel.x, sel.y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = "hsl(var(--primary))";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // Legend + High/Low pins
  if (g && resolved.mode !== "points-only") {
    if (resolved.showLegend)
      drawLegend(
        ctx,
        resolved,
        g,
        gridAndContours?.contours ?? null,
        overlay?.legendSelected ?? false,
      );
    if (resolved.showHighLow && points.length) {
      let hi = points[0],
        lo = points[0];
      for (const p of points) {
        if (p.value > hi.value) hi = p;
        if (p.value < lo.value) lo = p;
      }
      const hDx = livePinHigh ? livePinHigh.dx : (floor.highPinDx ?? 0);
      const hDy = livePinHigh ? livePinHigh.dy : (floor.highPinDy ?? 0);
      const lDx = livePinLow ? livePinLow.dx : (floor.lowPinDx ?? 0);
      const lDy = livePinLow ? livePinLow.dy : (floor.lowPinDy ?? 0);
      drawPin(ctx, hi.x + hDx, hi.y + hDy, "High", "#b51d16", highlightPin === "pin-high");
      drawPin(ctx, lo.x + lDx, lo.y + lDy, "Low", "#1f5f9f", highlightPin === "pin-low");
    }
  }
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  letter: string,
  color: string,
  highlighted = false,
) {
  ctx.font = "bold 11px sans-serif";
  const w = Math.max(PIN_MIN_W, ctx.measureText(letter).width + 14);
  ctx.beginPath();
  roundRectPath(ctx, x - w / 2, y + PIN_TOP_OFFSET, w, PIN_H, 10);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = highlighted ? "#17130e" : "#fff";
  ctx.lineWidth = highlighted ? 2.5 : 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, x, y + PIN_TOP_OFFSET + PIN_H / 2);
}

export function resolveSettings(settings: RenderSettings): RenderSettings {
  const contourStep =
    settings.contourStep ?? settings.interval ?? defaultRenderSettings.contourStep;
  return {
    ...defaultRenderSettings,
    ...settings,
    contourStep,
    interval: contourStep,
    contourCount: settings.contourCount ?? defaultRenderSettings.contourCount,
    decimalPlaces: settings.decimalPlaces ?? defaultRenderSettings.decimalPlaces,
    palette: settings.palette ?? defaultRenderSettings.palette,
    lineThickness: settings.lineThickness ?? defaultRenderSettings.lineThickness,
  };
}

function contourOptions(grid: Grid, settings: RenderSettings) {
  return {
    first: settings.firstContour,
    step: settings.contourStep,
    count: settings.contourCount ?? undefined,
    min: settings.minClamp ?? grid.minValue,
    max: settings.maxClamp ?? grid.maxValue,
  };
}

const PALETTE_LABELS: Record<RenderSettings["palette"], string> = {
  brown: "Earth Tone",
  rainbow: "Rainbow",
  "blue-red": "Blue → Red",
  gray: "Grayscale",
  ocean: "Ocean",
  sunset: "Sunset",
  forest: "Forest",
  viridis: "Viridis",
  topographic: "Topographic",
  "gray-amber": "Gray + Amber",
  "nm-sunset": "New Mexico Sunset",
  mountain: "Mountain Top",
};
const PRIMARY_PALETTES: RenderSettings["palette"][] = ["brown", "rainbow", "blue-red", "gray"];
const EXTRA_PALETTES: RenderSettings["palette"][] = [
  "ocean",
  "sunset",
  "forest",
  "viridis",
  "topographic",
  "gray-amber",
  "nm-sunset",
  "mountain",
];

function PaletteSwatch({ palette }: { palette: RenderSettings["palette"] }) {
  const bg = `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
    .map((t) => paletteColor(t, palette, false))
    .join(", ")})`;
  return <div className="h-4 w-full rounded-sm border" style={{ background: bg }} />;
}

function PaletteRow({
  palette,
  active,
  onClick,
}: {
  palette: RenderSettings["palette"];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md border px-2 py-1.5 text-xs transition ${
        active ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border hover:bg-accent"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{PALETTE_LABELS[palette]}</span>
        {active && <span className="text-[10px] text-primary">Selected</span>}
      </div>
      <PaletteSwatch palette={palette} />
    </button>
  );
}

function PalettePicker({
  value,
  onChange,
}: {
  value: RenderSettings["palette"];
  onChange: (p: RenderSettings["palette"]) => void;
}) {
  const activeInExtras = EXTRA_PALETTES.includes(value);
  const [expanded, setExpanded] = useState(activeInExtras);
  return (
    <div className="space-y-2">
      <Label className="text-xs">Palette</Label>
      <div className="space-y-1.5">
        {PRIMARY_PALETTES.map((p) => (
          <PaletteRow key={p} palette={p} active={value === p} onClick={() => onChange(p)} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left text-xs text-muted-foreground hover:text-foreground py-1"
      >
        {expanded ? "▾" : "▸"} More palettes
      </button>
      {expanded && (
        <div className="space-y-1.5">
          {EXTRA_PALETTES.map((p) => (
            <PaletteRow key={p} palette={p} active={value === p} onClick={() => onChange(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function paletteColor(input: number, palette: RenderSettings["palette"], reverse: boolean) {
  const t = reverse ? 1 - input : input;
  const stops: Record<RenderSettings["palette"], Array<[number, number, number]>> = {
    brown: [
      [92, 60, 35],
      [149, 99, 50],
      [201, 153, 83],
      [239, 213, 146],
      [116, 146, 118],
    ],
    rainbow: [
      [49, 75, 160],
      [46, 156, 202],
      [80, 177, 94],
      [245, 214, 79],
      [201, 65, 45],
    ],
    "blue-red": [
      [45, 86, 150],
      [120, 167, 204],
      [238, 222, 172],
      [206, 115, 73],
      [142, 45, 35],
    ],
    gray: [
      [42, 42, 42],
      [92, 92, 92],
      [145, 145, 145],
      [198, 198, 198],
      [238, 238, 238],
    ],
    ocean: [
      [10, 30, 70],
      [20, 80, 130],
      [40, 150, 175],
      [130, 210, 210],
      [235, 230, 200],
    ],
    sunset: [
      [50, 20, 80],
      [130, 40, 120],
      [220, 70, 110],
      [245, 140, 60],
      [250, 215, 100],
    ],
    forest: [
      [20, 50, 30],
      [45, 90, 55],
      [110, 140, 70],
      [180, 175, 110],
      [240, 232, 200],
    ],
    viridis: [
      [68, 1, 84],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37],
    ],
    topographic: [
      [90, 130, 80],
      [175, 190, 120],
      [220, 190, 140],
      [165, 120, 85],
      [245, 245, 245],
    ],
    "gray-amber": [
      [55, 55, 55],
      [110, 110, 110],
      [175, 175, 175],
      [220, 200, 150],
      [240, 175, 60],
    ],
    "nm-sunset": [
      [250, 170, 175],
      [235, 145, 145],
      [200, 165, 170],
      [150, 145, 150],
      [90, 95, 105],
    ],
    mountain: [
      [140, 100, 70],
      [80, 130, 60],
      [120, 170, 90],
      [230, 220, 200],
      [255, 255, 255],
    ],
  };
  const s = stops[palette];
  const scaled = Math.max(0, Math.min(0.999, t)) * (s.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = s[i];
  const b = s[i + 1] ?? a;
  const rgb = a.map((v, idx) => Math.round(v + (b[idx] - v) * f));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

const LEGEND_BASE_W = 82;
const LEGEND_BASE_H = 226;

function legendBox(settings: RenderSettings) {
  const s = settings.legendScale ?? 1;
  return {
    x: settings.legendX,
    y: settings.legendY,
    w: LEGEND_BASE_W * s,
    h: LEGEND_BASE_H * s,
    scale: s,
  };
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  settings: RenderSettings,
  grid: Grid,
  _contours: ReturnType<typeof computeContours> | null,
  selected: boolean,
) {
  const box = legendBox(settings);
  const s = box.scale;
  const min = settings.minClamp ?? grid.minValue;
  const max = settings.maxClamp ?? grid.maxValue;
  const span = Math.max(1e-6, max - min);

  const thresholds = contourThresholds(grid, contourOptions(grid, settings));

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "rgba(23,19,14,0.85)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, box.x, box.y, box.w, box.h, 6 * s);
  ctx.fill();
  ctx.stroke();

  const barX = box.x + 14 * s;
  const barY = box.y + 18 * s;
  const barW = 18 * s;
  const barH = box.h - 42 * s;

  const edges = [min, ...thresholds.filter((t) => t > min && t < max), max];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const mid = (lo + hi) / 2;
    const t = (mid - min) / span;
    const yTop = barY + barH - ((hi - min) / span) * barH;
    const yBot = barY + barH - ((lo - min) / span) * barH;
    ctx.fillStyle = paletteColor(t, settings.palette, settings.reversePalette);
    ctx.fillRect(barX, yTop, barW, yBot - yTop + 0.5);
  }
  ctx.strokeStyle = "#17130e";
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = "#17130e";
  ctx.font = `bold ${10 * s}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const labels: number[] = [];
  if (thresholds.length <= 7) {
    labels.push(...thresholds);
  } else {
    const stride = Math.ceil(thresholds.length / 6);
    for (let i = 0; i < thresholds.length; i += stride) labels.push(thresholds[i]);
    if (labels[labels.length - 1] !== thresholds[thresholds.length - 1]) {
      labels.push(thresholds[thresholds.length - 1]);
    }
  }
  for (const value of labels) {
    const y = barY + barH - ((value - min) / span) * barH;
    ctx.beginPath();
    ctx.moveTo(barX + barW, y);
    ctx.lineTo(barX + barW + 5 * s, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(settings.decimalPlaces), barX + barW + 8 * s, y);
  }

  ctx.fillStyle = "rgba(23,19,14,0.7)";
  ctx.font = `bold ${9 * s}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("ELEV.", box.x + box.w / 2, box.y + box.h - 12 * s);

  // Selection outline (indicates the legend is tappable / size slider is open)
  if (selected) {
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 2;
    roundRectPath(ctx, box.x - 2, box.y - 2, box.w + 4, box.h + 4, 8 * s);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
