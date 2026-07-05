import { useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import type { Floor, SurveyPoint } from "@/lib/types";
import { savePoint, deletePoint, uid } from "@/lib/db";

interface Props {
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
}

export function FieldTab({ floor, points, onPointsChange }: Props) {
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);

  const nextIndex = (points[points.length - 1]?.index ?? 0) + 1;
  const isBasePointCapture = points.length === 0;

  async function handleTap(x: number, y: number) {
    // if tapped very near existing point, ignore (edits done in Review)
    for (const p of points) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 12) return;
    }
    setPending({ x, y });
    if (isBasePointCapture) setBpPromptOpen(true);
  }

  async function submitValue(v: number) {
    if (!pending) return;
    const now = Date.now();
    const idx = nextIndex;
    const isBP = isBasePointCapture;
    const point: SurveyPoint = {
      id: uid(),
      floorId: floor.id,
      index: idx,
      x: pending.x,
      y: pending.y,
      value: v,
      isBasePoint: isBP,
      label: isBP ? "BP1" : undefined,
      createdAt: now,
    };
    await savePoint(point);
    onPointsChange([...points, point]);
    setPending(null);
    setBpPromptOpen(false);
  }

  async function undoLast() {
    const last = points[points.length - 1];
    if (!last) return;
    await deletePoint(last.id);
    onPointsChange(points.slice(0, -1));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-3 py-2 flex items-center gap-3 text-sm">
        <div>
          <span className="font-medium">{points.length}</span>
          <span className="text-muted-foreground"> points</span>
        </div>
        {points.length > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <div>
              Next: <span className="font-mono font-medium">#{nextIndex}</span>
            </div>
          </>
        )}
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={undoLast} disabled={points.length === 0}>
            <Undo2 className="h-4 w-4 mr-1" /> Undo
          </Button>
        </div>
      </div>

      {floor.boundary.length < 3 && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-3 py-2">
          Draw a boundary in Setup → Boundary before collecting points.
        </div>
      )}
      {!floor.scale && points.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-900 text-xs px-3 py-2">
          No scale calibrated yet — you can add it later in Setup → Scale.
        </div>
      )}

      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        onTap={handleTap}
        drawOverlay={(ctx) => {
          // boundary
          if (floor.boundary.length > 1) {
            ctx.beginPath();
            floor.boundary.forEach((p, i) =>
              i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
            );
            if (floor.boundary.length > 2) ctx.closePath();
            ctx.strokeStyle = "rgba(37,99,235,0.6)";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          // points
          for (const p of points) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = p.isBasePoint ? "#16a34a" : "#111827";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(p.index), p.x, p.y);
            // value label
            ctx.fillStyle = "#111827";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(p.value.toFixed(2), p.x + 12, p.y + 8);
          }
          // pending marker
          if (pending) {
            ctx.beginPath();
            ctx.arc(pending.x, pending.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = "#dc2626";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }}
      />

      <NumericKeypad
        open={!!pending && !bpPromptOpen}
        initialValue={isBasePointCapture ? 9.0 : points[points.length - 1]?.value}
        title={isBasePointCapture ? "Base Point value (BP1)" : `Point #${nextIndex}`}
        subtitle="Inches. Positive = higher, negative = lower."
        onClose={() => setPending(null)}
        onSubmit={submitValue}
      />

      {/* Base Point confirmation prompt */}
      {bpPromptOpen && pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-background rounded-xl shadow-2xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold mb-1">Set Base Point</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This is your first point. It becomes <span className="font-mono">BP1</span>, the
              reference elevation. Default is 9.0". Tap Continue to enter its value.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setPending(null); setBpPromptOpen(false); }}>
                Cancel
              </Button>
              <Button onClick={() => setBpPromptOpen(false)}>Continue</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
