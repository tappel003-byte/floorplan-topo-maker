import { useMemo, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { interpolateTurbo } from "d3-scale-chromatic";
import type { Floor, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { buildGrid, computeContours, chaikin } from "@/lib/topo";

interface Props {
  floor: Floor;
  points: SurveyPoint[];
  settings: RenderSettings;
  onSettingsChange: (s: RenderSettings) => void;
}

export function TopoTab({ floor, points, settings, onSettingsChange }: Props) {
  const [panelOpen, setPanelOpen] = useState(true);

  const canRender = points.length >= 3 && floor.boundary.length >= 3;

  const gridAndContours = useMemo(() => {
    if (!canRender) return null;
    const grid = buildGrid(points, floor.boundary, 240, settings.sharpness);
    if (!grid) return null;
    const cs = computeContours(grid, settings.interval);
    return { grid, contours: cs };
  }, [canRender, points, floor.boundary, settings.interval, settings.sharpness]);


  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-2 flex items-center gap-2 text-sm flex-wrap">
        <select
          value={settings.mode}
          onChange={(e) =>
            onSettingsChange({ ...settings, mode: e.target.value as RenderSettings["mode"] })
          }
          className="rounded-md border px-2 py-1.5 text-sm bg-background"
        >
          <option value="contour-bw">B&W contours</option>
          <option value="contour-fill">Color fill contours</option>
          <option value="contour-cells">Color cells</option>
          <option value="points-only">Points only</option>
        </select>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">Interval</Label>
          <Input
            type="number"
            step="0.05"
            value={settings.interval}
            onChange={(e) =>
              onSettingsChange({ ...settings, interval: parseFloat(e.target.value) || 0.1 })
            }
            className="w-20 h-8"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setPanelOpen((v) => !v)}
        >
          {panelOpen ? "Hide layers" : "Layers"}
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

      <div className="flex-1 relative min-h-0">
        <PlanCanvas
          planDataUrl={floor.planDataUrl}
          planWidth={floor.planWidth}
          planHeight={floor.planHeight}
          hidePlan={!settings.showPlan}
          planOpacity={settings.planOpacity}
          drawOverlay={(ctx) => {
            renderTopo(ctx, floor, points, settings, gridAndContours);
          }}
        />
        {panelOpen && (
          <div className="absolute top-2 right-14 rounded-lg border bg-background/95 shadow-lg p-3 w-56 space-y-3 text-sm">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Plan</Label>
                <Switch
                  checked={settings.showPlan}
                  onCheckedChange={(v) => onSettingsChange({ ...settings, showPlan: v })}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <Label className="text-xs text-muted-foreground">Transparent</Label>
                <Switch
                  checked={settings.planOpacity < 1}
                  disabled={!settings.showPlan}
                  onCheckedChange={(v) =>
                    onSettingsChange({ ...settings, planOpacity: v ? 0.5 : 1 })
                  }
                />
              </div>
            </div>

            <LayerRow
              label="Contours"
              on={settings.showContours}
              onToggle={(v) => onSettingsChange({ ...settings, showContours: v })}
              opacity={settings.contourOpacity}
              onOpacity={(v) => onSettingsChange({ ...settings, contourOpacity: v })}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Labels</Label>
              <Switch
                checked={settings.showLabels}
                onCheckedChange={(v) => onSettingsChange({ ...settings, showLabels: v })}
              />
            </div>
            <LayerRow
              label="Points"
              on={settings.showPoints}
              onToggle={(v) => onSettingsChange({ ...settings, showPoints: v })}
              opacity={settings.pointsOpacity}
              onOpacity={(v) => onSettingsChange({ ...settings, pointsOpacity: v })}
            />
          </div>
        )}
      </div>
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
  // clip to boundary polygon
  if (floor.boundary.length >= 3) {
    ctx.save();
    ctx.beginPath();
    floor.boundary.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();

    const g = gridAndContours?.grid;
    if (g && settings.showContours && (settings.mode === "contour-cells" || settings.mode === "contour-fill")) {
      // Color cells: draw each grid cell as a rect using turbo scale
      if (settings.mode === "contour-cells") {
        const range = g.maxValue - g.minValue || 1;
        for (let r = 0; r < g.height; r++) {
          for (let c = 0; c < g.width; c++) {
            const idx = r * g.width + c;
            if (!g.mask[idx]) continue;
            const t = (g.values[idx] - g.minValue) / range;
            ctx.fillStyle = interpolateTurbo(t);
            ctx.globalAlpha = settings.contourOpacity;
            ctx.fillRect(g.x0 + c * g.step, g.y0 + r * g.step, g.step + 0.5, g.step + 0.5);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // Contour polygons — drawn in IMAGE coords so line widths render correctly.
    const cs = gridAndContours?.contours;
    if (cs && g && settings.showContours && settings.mode !== "points-only" && settings.mode !== "contour-cells") {
      const range = g.maxValue - g.minValue || 1;
      const toX = (px: number) => g.x0 + px * g.step;
      const toY = (py: number) => g.y0 + py * g.step;
      for (const c of cs) {
        ctx.beginPath();
        for (const poly of c.coordinates) {
          for (const ring of poly) {
            const smooth = chaikin(ring as Array<[number, number]>, 3, true);
            smooth.forEach((pt, i) =>
              i === 0 ? ctx.moveTo(toX(pt[0]), toY(pt[1])) : ctx.lineTo(toX(pt[0]), toY(pt[1])),
            );
            ctx.closePath();
          }
        }

        if (settings.mode === "contour-fill") {
          const t = (c.value - g.minValue) / range;
          ctx.fillStyle = interpolateTurbo(t);
          ctx.globalAlpha = 0.55 * settings.contourOpacity;
          ctx.fill();
          ctx.globalAlpha = settings.contourOpacity;
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          // contour-bw — major (whole-inch) lines heavier
          const isMajor = Math.abs(c.value - Math.round(c.value)) < 1e-6;
          ctx.strokeStyle = "#111";
          ctx.lineWidth = isMajor ? 2.2 : 1.1;
          ctx.globalAlpha = settings.contourOpacity;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }


  // Labels along contours: place at rough midpoint of each contour ring
  if (
    settings.showLabels &&
    gridAndContours?.contours &&
    gridAndContours.grid &&
    settings.mode !== "points-only"
  ) {
    const g = gridAndContours.grid;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of gridAndContours.contours) {
      for (const poly of c.coordinates) {
        for (const ring of poly) {
          if (ring.length < 8) continue;
          const mid = ring[Math.floor(ring.length / 2)];
          const wx = g.x0 + mid[0] * g.step;
          const wy = g.y0 + mid[1] * g.step;
          const label = c.value.toFixed(2);
          const w = ctx.measureText(label).width + 6;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(wx - w / 2, wy - 8, w, 16);
          ctx.fillStyle = "#111";
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
  if (settings.showPoints) {
    ctx.globalAlpha = settings.pointsOpacity;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.isBasePoint ? "#16a34a" : "#111";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(p.value.toFixed(2), p.x + 8, p.y + 6);
    }
    ctx.globalAlpha = 1;
  }

  // Legend + High/Low pins
  if (gridAndContours?.grid && settings.mode !== "points-only") {
    const g = gridAndContours.grid;
    // find H/L point locations
    let hi = points[0], lo = points[0];
    for (const p of points) {
      if (p.value > hi.value) hi = p;
      if (p.value < lo.value) lo = p;
    }
    if (hi && lo) {
      drawPin(ctx, hi.x, hi.y, "H", "#dc2626");
      drawPin(ctx, lo.x, lo.y, "L", "#2563eb");
    }
    void g;
  }
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  letter: string,
  color: string,
) {
  ctx.beginPath();
  ctx.arc(x, y - 14, 10, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, x, y - 14);
}
