import { useMemo, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { Floor, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { buildGrid, clampValue, computeContours, type Grid } from "@/lib/topo";

interface Props {
  floor: Floor;
  points: SurveyPoint[];
  settings: RenderSettings;
  onSettingsChange: (s: RenderSettings) => void;
}

export function TopoTab({ floor, points, settings, onSettingsChange }: Props) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [legendDrag, setLegendDrag] = useState<{ dx: number; dy: number } | null>(null);
  const resolved = resolveSettings(settings);

  const canRender = points.length >= 3 && floor.boundary.length >= 3;

  const gridAndContours = useMemo(() => {
    if (!canRender) return null;
    const grid = buildGrid(points, floor.boundary, 190);
    if (!grid) return null;
    const cs = computeContours(grid, contourOptions(grid, resolved));
    return { grid, contours: cs };
  }, [canRender, points, floor.boundary, resolved.firstContour, resolved.contourStep, resolved.contourCount, resolved.minClamp, resolved.maxClamp]);

  const update = (patch: Partial<RenderSettings>) => onSettingsChange(resolveSettings({ ...resolved, ...patch }));

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
          <Input
            type="number"
            step="0.05"
            value={resolved.contourStep}
            onChange={(e) => {
              const step = parseFloat(e.target.value) || 0.1;
              update({ contourStep: step, interval: step });
            }}
            className="w-20 h-10"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">Count</Label>
          <Input
            type="number"
            min={2}
            max={40}
            value={resolved.contourCount}
            onChange={(e) => update({ contourCount: Math.max(2, parseInt(e.target.value, 10) || 12) })}
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
          planOpacity={resolved.planOpacity}
          onImagePointerDown={(x, y) => {
            if (!resolved.showLegend || !gridAndContours?.grid || resolved.mode === "points-only") return false;
            const box = legendBox(resolved);
            if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
              setLegendDrag({ dx: x - box.x, dy: y - box.y });
              return true;
            }
            return false;
          }}
          onImagePointerMove={(x, y) => {
            if (legendDrag) update({ legendX: Math.max(0, x - legendDrag.dx), legendY: Math.max(0, y - legendDrag.dy) });
          }}
          onImagePointerUp={() => setLegendDrag(null)}
          drawOverlay={(ctx) => {
            renderTopo(ctx, floor, points, resolved, gridAndContours);
          }}
        />
        {panelOpen && (
          <div className="absolute top-2 right-14 rounded-lg border bg-background/95 shadow-lg p-3 w-72 max-h-[calc(100%-1rem)] overflow-auto space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <NumberControl label="Min clamp" value={resolved.minClamp} placeholder="auto" onChange={(v) => update({ minClamp: v })} />
              <NumberControl label="Max clamp" value={resolved.maxClamp} placeholder="auto" onChange={(v) => update({ maxClamp: v })} />
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
            <LayerRow
              label="Plan"
              on={resolved.showPlan}
              onToggle={(v) => update({ showPlan: v })}
              opacity={resolved.planOpacity}
              onOpacity={(v) => update({ planOpacity: v })}
            />
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
            <LayerRow
              label="Points"
              on={resolved.showPoints}
              onToggle={(v) => update({ showPoints: v })}
              opacity={resolved.pointsOpacity}
              onOpacity={(v) => update({ pointsOpacity: v })}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Legend</Label>
              <Switch checked={resolved.showLegend} onCheckedChange={(v) => update({ showLegend: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">High / low pins</Label>
              <Switch checked={resolved.showHighLow} onCheckedChange={(v) => update({ showHighLow: v })} />
            </div>
          </div>
        )}
      </div>
    </div>
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
    grid: ReturnType<typeof buildGrid>;
    contours: ReturnType<typeof computeContours>;
  } | null,
) {
  const resolved = resolveSettings(settings);
  const g = gridAndContours?.grid ?? null;
  const paletteMin = resolved.minClamp ?? g?.minValue ?? 0;
  const paletteMax = resolved.maxClamp ?? g?.maxValue ?? 1;

  // clip to boundary polygon
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

  // Labels along contours: place at rough midpoint of each contour ring
  if (
    resolved.showLabels &&
    gridAndContours?.contours &&
    gridAndContours.grid &&
    resolved.mode !== "points-only" &&
    resolved.mode !== "contour-cells"
  ) {
    const g = gridAndContours.grid;
    ctx.font = `bold ${Math.max(10, 12 + resolved.lineThickness)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of gridAndContours.contours) {
      for (const poly of c.coordinates) {
        for (const ring of poly) {
          if (ring.length < 8) continue;
          const mid = ring[Math.floor(ring.length / 2)];
          const wx = g.x0 + mid[0] * g.step;
          const wy = g.y0 + mid[1] * g.step;
          const label = c.value.toFixed(resolved.decimalPlaces);
          const w = ctx.measureText(label).width + 6;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(wx - w / 2, wy - 8, w, 16);
          ctx.fillStyle = "#17130e";
          ctx.fillText(label, wx, wy);
        }
      }
    }
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

  // Points
  if (resolved.showPoints) {
    ctx.globalAlpha = resolved.pointsOpacity;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.isBasePoint ? "#16834a" : "#17130e";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#17130e";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(p.value.toFixed(resolved.decimalPlaces), p.x + 8, p.y + 6);
    }
    ctx.globalAlpha = 1;
  }

  // Legend + High/Low pins
  if (g && resolved.mode !== "points-only") {
    if (resolved.showLegend) drawLegend(ctx, resolved, g);
    if (resolved.showHighLow && points.length) {
      let hi = points[0], lo = points[0];
      for (const p of points) {
        if (p.value > hi.value) hi = p;
        if (p.value < lo.value) lo = p;
      }
      drawPin(ctx, hi.x, hi.y, `H ${hi.value.toFixed(resolved.decimalPlaces)}`, "#b51d16");
      drawPin(ctx, lo.x, lo.y, `L ${lo.value.toFixed(resolved.decimalPlaces)}`, "#1f5f9f");
    }
  }
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  letter: string,
  color: string,
) {
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
    count: settings.contourCount,
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

function drawLegend(ctx: CanvasRenderingContext2D, settings: RenderSettings, grid: Grid) {
  const box = legendBox(settings);
  const min = settings.minClamp ?? grid.minValue;
  const max = settings.maxClamp ?? grid.maxValue;
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
  const steps = 80;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const y = barY + barH - (i + 1) * (barH / steps);
    ctx.fillStyle = paletteColor(t0, settings.palette, settings.reversePalette);
    ctx.fillRect(barX, y, barW, barH / steps + 1);
  }
  ctx.strokeStyle = "#17130e";
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = "#17130e";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const ticks = Math.min(7, Math.max(3, settings.contourCount));
  for (let i = 0; i < ticks; i++) {
    const t = i / (ticks - 1);
    const value = max - (max - min) * t;
    const y = barY + barH * t;
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
