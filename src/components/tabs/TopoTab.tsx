import { useMemo, useRef, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Undo2 } from "lucide-react";
import type { Floor, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { buildGrid, clampValue, computeContours, contourThresholds, type Grid } from "@/lib/topo";
import { savePoint, saveFloor } from "@/lib/db";

interface Props {
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  onFloorChange: (floor: Floor) => void;
  settings: RenderSettings;
  onSettingsChange: (s: RenderSettings) => void;
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



export function TopoTab({ floor, points, onPointsChange, onFloorChange, settings, onSettingsChange }: Props) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [legendDrag, setLegendDrag] = useState<{ dx: number; dy: number } | null>(null);
  const resolved = resolveSettings(settings);

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

  const canRender = points.length >= 3 && floor.boundary.length >= 3;

  const gridAndContours = useMemo(() => {
    if (!canRender) return null;
    const grid = buildGrid(points, floor.boundary, 190);
    if (!grid) return null;
    const cs = computeContours(grid, contourOptions(grid, resolved));
    return { grid, contours: cs };
  }, [canRender, points, floor.boundary, resolved.firstContour, resolved.contourStep, resolved.contourCount, resolved.minClamp, resolved.maxClamp]);

  const update = (patch: Partial<RenderSettings>) => onSettingsChange(resolveSettings({ ...resolved, ...patch }));

  // Compute current High / Low points (matches renderTopoTop logic).
  const hiLo = useMemo(() => {
    if (!points.length) return null;
    let hi = points[0], lo = points[0];
    for (const p of points) {
      if (p.value > hi.value) hi = p;
      if (p.value < lo.value) lo = p;
    }
    return { hi, lo };
  }, [points]);

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
      if (check("pin-high", hiLo.hi, hDx, hDy)) return { kind: "pin-high", point: hiLo.hi, dx: hDx, dy: hDy };
      if (check("pin-low", hiLo.lo, lDx, lDy)) return { kind: "pin-low", point: hiLo.lo, dx: lDx, dy: lDy };
    }
    // Point-number labels
    if (resolved.showPoints) {
      const dec = resolved.decimalPlaces;
      const fontPx = resolved.pointLabelFontSize;
      const weight = resolved.pointLabelWeight;
      const pad = 4;
      for (const p of points) {
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
      if (!p) { setLastMove(null); return; }
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
      floor.highPinDx !== undefined || floor.highPinDy !== undefined ||
      floor.lowPinDx !== undefined || floor.lowPinDy !== undefined
    ) {
      const cleared: Floor = {
        ...floor,
        highPinDx: undefined, highPinDy: undefined,
        lowPinDx: undefined, lowPinDy: undefined,
      };
      onFloorChange(cleared);
      saveFloor(cleared).catch(() => {});
    }
    setLastMove(null);
  }



  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-2 flex items-end gap-2 text-sm flex-wrap">
        <select
          value={resolved.mode}
          onChange={(e) =>
            update({ mode: e.target.value as RenderSettings["mode"] })
          }
          className="rounded-md border px-2 py-2 text-sm bg-background h-10"
        >
          <option value="contour-fill">Color fill contours</option>
          <option value="contour-cells">Color cells</option>
          <option value="contour-bw">Simple B&W contours</option>
          <option value="points-only">Points only</option>
        </select>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">First</Label>
          <Input
            type="number"
            step="0.05"
            value={resolved.firstContour ?? ""}
            placeholder="auto"
            onChange={(e) => update({ firstContour: e.target.value === "" ? null : parseFloat(e.target.value) })}
            className="w-20 h-10"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">Step</Label>
          <StepInput
            value={resolved.contourStep}
            onCommit={(step) => update({ contourStep: step, interval: step })}
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">Count</Label>
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
            className="w-20 h-10"
          />
        </div>
        {gridAndContours?.grid && (
          <div className="text-xs text-muted-foreground tabular-nums px-2 py-2">
            Range {gridAndContours.grid.minValue.toFixed(2)}" to {gridAndContours.grid.maxValue.toFixed(2)}" · {points.length} points
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setPanelOpen((v) => !v)}
        >
          {panelOpen ? "Hide controls" : "Controls"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSettingsChange(defaultRenderSettings)}
        >
          Reset
        </Button>
      </div>

      {!canRender && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-3 py-2">
          Need at least 3 points and a closed boundary to generate a topo.
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
            // Legend drag first
            if (resolved.showLegend && gridAndContours?.grid && resolved.mode !== "points-only") {
              const box = legendBox(resolved);
              if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
                setLegendDrag({ dx: x - box.x, dy: y - box.y });
                return true;
              }
            }
            // Long-press on a label or a H/L pin to pick it up
            const hit = hitDraggable(x, y);
            if (hit) {
              const startDx =
                hit.kind === "label"
                  ? hit.point.labelDx ?? DEFAULT_LABEL_DX
                  : hit.dx;
              const startDy =
                hit.kind === "label"
                  ? hit.point.labelDy ?? DEFAULT_LABEL_DY
                  : hit.dy;
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
              update({ legendX: Math.max(0, x - legendDrag.dx), legendY: Math.max(0, y - legendDrag.dy) });
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
            const activeLabel = drag && drag.active && drag.kind === "label"
              ? { id: drag.id, dx: drag.dx, dy: drag.dy }
              : null;
            const activePinHigh = drag && drag.active && drag.kind === "pin-high"
              ? { dx: drag.dx, dy: drag.dy }
              : null;
            const activePinLow = drag && drag.active && drag.kind === "pin-low"
              ? { dx: drag.dx, dy: drag.dy }
              : null;
            renderTopoTop(ctx, floor, points, resolved, gridAndContours, {
              liveDrag: activeLabel,
              highlightId: activeLabel?.id ?? null,
              livePinHigh: activePinHigh,
              livePinLow: activePinLow,
              highlightPin: drag?.active && drag.kind !== "label" ? drag.kind : null,
            });
          }}
        />

        {panelOpen && (
          <div className="absolute top-2 right-14 rounded-xl border bg-card shadow-2xl p-3 w-72 max-h-[calc(100%-1rem)] overflow-auto space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <NumberControl label="Decimals" value={resolved.decimalPlaces} min={0} max={3} step={1} onChange={(v) => update({ decimalPlaces: Math.max(0, Math.min(3, Math.round(v ?? 2))) })} />
              <div>
                <Label className="text-xs">Palette</Label>
                <select
                  value={resolved.palette}
                  onChange={(e) => update({ palette: e.target.value as RenderSettings["palette"] })}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
                >
                  <option value="brown">Brown elevation</option>
                  <option value="rainbow">Rainbow</option>
                  <option value="blue-red">Blue to red</option>
                  <option value="gray">Grayscale</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show floor plan</Label>
              <Switch checked={resolved.showPlan} onCheckedChange={(v) => update({ showPlan: v })} />
            </div>
            <LayerRow
              label="Contours"
              on={resolved.showContours}
              onToggle={(v) => update({ showContours: v })}
              opacity={resolved.contourOpacity}
              onOpacity={(v) => update({ contourOpacity: v })}
            />
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Line thickness</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{resolved.lineThickness.toFixed(1)}</span>
              </div>
              <Slider min={0.5} max={4} step={0.1} value={[resolved.lineThickness]} onValueChange={(v) => update({ lineThickness: v[0] })} className="mt-2" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Labels</Label>
              <Switch
                checked={resolved.showLabels}
                onCheckedChange={(v) => update({ showLabels: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Reverse palette</Label>
              <Switch checked={resolved.reversePalette} onCheckedChange={(v) => update({ reversePalette: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Points</Label>
              <Switch
                checked={resolved.showPoints}
                onCheckedChange={(v) => update({ showPoints: v, pointsOpacity: 1 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Label background</Label>
              <Switch
                checked={resolved.pointLabelBackground === "white"}
                onCheckedChange={(v) => update({ pointLabelBackground: v ? "white" : "transparent" })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <span className="text-[11px] text-muted-foreground leading-tight">
                Long-press a number on the map to move it.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={undoLastMove}
                disabled={!lastMove}
                className="h-8 px-2 gap-1 shrink-0"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            </div>
            <details className="border-t pt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">Label style</summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <NumberControl
                  label="Font size"
                  value={resolved.pointLabelFontSize}
                  min={7}
                  max={28}
                  step={1}
                  onChange={(v) => update({ pointLabelFontSize: Math.max(7, Math.min(28, Math.round(v ?? 11))) })}
                />
                <div>
                  <Label className="text-xs">Weight</Label>
                  <select
                    value={resolved.pointLabelWeight}
                    onChange={(e) => update({ pointLabelWeight: e.target.value as "normal" | "bold" })}
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
                Reset all label positions
              </Button>
            </details>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Legend</Label>
              <Switch checked={resolved.showLegend} onCheckedChange={(v) => update({ showLegend: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">High / low pins</Label>
              <Switch checked={resolved.showHighLow} onCheckedChange={(v) => update({ showHighLow: v })} />
            </div>
            <details className="border-t pt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">Advanced</summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <NumberControl label="Color min" value={resolved.minClamp} placeholder="auto" onChange={(v) => update({ minClamp: v })} />
                <NumberControl label="Color max" value={resolved.maxClamp} placeholder="auto" onChange={(v) => update({ maxClamp: v })} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                Force the color scale to a fixed range. Leave auto for normal use.
              </p>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

// Free-form step input. Keeps local text state so partial input like "." or
// "0." doesn't clobber the committed value mid-typing.
function StepInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
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

function LayerRow({
  label,
  on,
  onToggle,
  opacity,
  onOpacity,
}: {
  label: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  opacity: number;
  onOpacity: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Switch checked={on} onCheckedChange={onToggle} />
      </div>
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={[opacity]}
        onValueChange={(v) => onOpacity(v[0])}
        className="mt-1"
        disabled={!on}
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
export function renderTopoBase(
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
    if (cs && g && resolved.showContours && resolved.mode !== "points-only" && resolved.mode !== "contour-cells") {
      ctx.save();
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

  // Boundary line
  if (floor.boundary.length >= 3) {
    ctx.beginPath();
    floor.boundary.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// Top pass: points, point labels, high/low pins, legend. Meant to sit OVER the wall plan.
export function renderTopoTop(
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
    for (const p of points) {
      // dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.isBasePoint ? "#16834a" : "#17130e";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // label
      const text = p.value.toFixed(resolved.decimalPlaces);
      ctx.font = `${weight} ${fontPx}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const isLive = live && live.id === p.id;
      const dx = isLive ? live!.dx : p.labelDx ?? DEFAULT_LABEL_DX;
      const dy = isLive ? live!.dy : p.labelDy ?? DEFAULT_LABEL_DY;
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
  }

  // Legend + High/Low pins
  if (g && resolved.mode !== "points-only") {
    if (resolved.showLegend) drawLegend(ctx, resolved, g, gridAndContours?.contours ?? null);
    if (resolved.showHighLow && points.length) {
      let hi = points[0], lo = points[0];
      for (const p of points) {
        if (p.value > hi.value) hi = p;
        if (p.value < lo.value) lo = p;
      }
      const hDx = livePinHigh ? livePinHigh.dx : floor.highPinDx ?? 0;
      const hDy = livePinHigh ? livePinHigh.dy : floor.highPinDy ?? 0;
      const lDx = livePinLow ? livePinLow.dx : floor.lowPinDx ?? 0;
      const lDy = livePinLow ? livePinLow.dy : floor.lowPinDy ?? 0;
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

  const w = Math.max(24, ctx.measureText(letter).width + 14);
  ctx.beginPath();
  roundRectPath(ctx, x - w / 2, y - 28, w, 20, 10);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, x, y - 18);
}

export function resolveSettings(settings: RenderSettings): RenderSettings {
  const contourStep = settings.contourStep ?? settings.interval ?? defaultRenderSettings.contourStep;
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

export function paletteColor(input: number, palette: RenderSettings["palette"], reverse: boolean) {
  const t = reverse ? 1 - input : input;
  const stops: Record<RenderSettings["palette"], Array<[number, number, number]>> = {
    brown: [[92, 60, 35], [149, 99, 50], [201, 153, 83], [239, 213, 146], [116, 146, 118]],
    rainbow: [[49, 75, 160], [46, 156, 202], [80, 177, 94], [245, 214, 79], [201, 65, 45]],
    "blue-red": [[45, 86, 150], [120, 167, 204], [238, 222, 172], [206, 115, 73], [142, 45, 35]],
    gray: [[42, 42, 42], [92, 92, 92], [145, 145, 145], [198, 198, 198], [238, 238, 238]],
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

function legendBox(settings: RenderSettings) {
  return { x: settings.legendX, y: settings.legendY, w: 82, h: 226 };
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  settings: RenderSettings,
  grid: Grid,
  _contours: ReturnType<typeof computeContours> | null,
) {
  const box = legendBox(settings);
  const min = settings.minClamp ?? grid.minValue;
  const max = settings.maxClamp ?? grid.maxValue;
  const span = Math.max(1e-6, max - min);

  // Contour thresholds — the same values used to draw bands on the map.
  const thresholds = contourThresholds(grid, contourOptions(grid, settings));

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "rgba(23,19,14,0.85)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, box.x, box.y, box.w, box.h, 6);
  ctx.fill();
  ctx.stroke();

  const barX = box.x + 14;
  const barY = box.y + 18;
  const barW = 18;
  const barH = box.h - 42;

  // Build band edges from min → thresholds → max so the swatches match the map fill.
  const edges = [min, ...thresholds.filter((t) => t > min && t < max), max];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    // Sample color at the band midpoint, same as color-fill-contours mode.
    const mid = (lo + hi) / 2;
    const t = (mid - min) / span;
    const yTop = barY + barH - ((hi - min) / span) * barH;
    const yBot = barY + barH - ((lo - min) / span) * barH;
    ctx.fillStyle = paletteColor(t, settings.palette, settings.reversePalette);
    ctx.fillRect(barX, yTop, barW, yBot - yTop + 0.5);
  }
  ctx.strokeStyle = "#17130e";
  ctx.strokeRect(barX, barY, barW, barH);

  // Tick labels on actual contour thresholds, subsampled to ~5–7 across the bar.
  ctx.fillStyle = "#17130e";
  ctx.font = "bold 10px sans-serif";
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
    ctx.lineTo(barX + barW + 5, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(settings.decimalPlaces), barX + barW + 8, y);
  }

  ctx.fillStyle = "rgba(23,19,14,0.7)";
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ELEV.", box.x + box.w / 2, box.y + box.h - 12);
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
