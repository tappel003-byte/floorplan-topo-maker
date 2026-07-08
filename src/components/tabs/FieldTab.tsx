import { useEffect, useRef, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { DataPointsPanel } from "../DataPointsPanel";
import { Button } from "@/components/ui/button";
import { Trash2, Undo2 } from "lucide-react";
import type { Floor, SurveyPoint } from "@/lib/types";
import { savePoint, deletePoint, uid } from "@/lib/db";

interface Props {
  projectId: string;
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}

export function FieldTab({ projectId, floor, points, onPointsChange, selectedIds, setSelectedIds }: Props) {
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const [dragging, setDragging] = useState<{ id: string; moved: boolean } | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const trashRef = useRef<HTMLButtonElement | null>(null);
  const pointerScreenRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!dragging) {
      setTrashHover(false);
      return;
    }
    function onMove(e: PointerEvent) {
      pointerScreenRef.current = { x: e.clientX, y: e.clientY };
      const el = trashRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      setTrashHover(over);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [dragging]);

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
    if (editingPoint) {
      const updated = { ...editingPoint, value: v };
      await savePoint(updated);
      onPointsChange(points.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPoint(null);
      return;
    }
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

  function hitPoint(x: number, y: number) {
    return points.find((p) => Math.hypot(p.x - x, p.y - y) < 18) ?? null;
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

      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        onTap={handleTap}
        onImagePointerDown={(x, y) => {
          const hit = hitPoint(x, y);
          if (!hit) return false;
          setSelectedIds(new Set([hit.id]));
          setDragging({ id: hit.id, moved: false });
          return true;
        }}
        onImagePointerMove={(x, y) => {
          if (!dragging) return;
          setDragging({ ...dragging, moved: true });
          onPointsChange(points.map((p) => (p.id === dragging.id ? { ...p, x, y } : p)));
        }}
        onImagePointerUp={async (x, y) => {
          if (!dragging) return;
          const point = points.find((p) => p.id === dragging.id);
          const wasOverTrash = trashHover;
          const dragId = dragging.id;
          setDragging(null);
          setTrashHover(false);
          if (!point) return;
          if (wasOverTrash) {
            await deletePoint(dragId);
            onPointsChange(points.filter((p) => p.id !== dragId));
            return;
          }
          if (!dragging.moved) {
            setEditingPoint(point);
            return;
          }
          const updated = { ...point, x, y };
          await savePoint(updated);
        }}
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
            const sel = selectedIds.has(p.id);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = p.isBasePoint ? "#16a34a" : "#111827";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
            if (sel) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 3;
              ctx.stroke();
            }
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

      {dragging && (
        <button
          ref={trashRef}
          type="button"
          aria-label="Delete point"
          className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 rounded-full shadow-lg flex items-center justify-center transition-all ${
            trashHover
              ? "bg-destructive text-destructive-foreground scale-110 h-20 w-20"
              : "bg-background text-destructive border-2 border-destructive h-16 w-16"
          }`}
        >
          <Trash2 className={trashHover ? "h-9 w-9" : "h-7 w-7"} />
        </button>
      )}


      <NumericKeypad
        open={(!!pending && !bpPromptOpen) || !!editingPoint}
        initialValue={editingPoint?.value ?? (isBasePointCapture ? 9.0 : undefined)}
        repeatValue={!editingPoint && !isBasePointCapture ? points[points.length - 1]?.value : undefined}
        title={editingPoint ? `Edit point #${editingPoint.index}` : isBasePointCapture ? "Base Point value (BP1)" : `Point #${nextIndex}`}
        subtitle="Inches. Positive = higher, negative = lower."
        onClose={() => { setPending(null); setEditingPoint(null); }}
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
