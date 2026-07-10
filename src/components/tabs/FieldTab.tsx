import { useEffect, useRef, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { DataPointsPanel } from "../DataPointsPanel";
import { NoteDialog } from "../NoteDialog";
import { Button } from "@/components/ui/button";
import { Undo2, StickyNote } from "lucide-react";
import type { Floor, FloorNote, SurveyPoint } from "@/lib/types";
import { savePoint, deletePoint, saveNote, deleteNote, listNotes, uid } from "@/lib/db";


interface Props {
  projectId: string;
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}

type DragState = {
  id: string;
  moved: boolean;
  startClientX: number;
  startClientY: number;
  /** Finger position in image coords at pointer-down. */
  startImgX: number;
  startImgY: number;
  /** Point's original position at pointer-down. */
  origX: number;
  origY: number;
  lastX: number;
  lastY: number;
};

export function FieldTab({ projectId, floor, points, onPointsChange, selectedIds, setSelectedIds }: Props) {
  const scaleRef = useRef(1);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Notes
  const [notes, setNotes] = useState<FloorNote[]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [editingNote, setEditingNote] = useState<FloorNote | null>(null);
  const [newNoteAt, setNewNoteAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    listNotes(floor.id).then(setNotes).catch(() => setNotes([]));
  }, [floor.id]);

  const [pointSize, setPointSize] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(`dpp-size:${projectId}`);
      const n = raw ? Number(raw) : 2;
      return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 2;
    } catch { return 2; }
  });
  useEffect(() => {
    try { localStorage.setItem(`dpp-size:${projectId}`, String(pointSize)); } catch {}
  }, [pointSize, projectId]);

  // Silence unused-var when dragging state isn't read directly in render.
  void dragging;

  const nextIndex = (points[points.length - 1]?.index ?? 0) + 1;
  const isBasePointCapture = points.length === 0;

  // Note hit test — small square pinned at (x,y).
  function hitNote(x: number, y: number): FloorNote | null {
    const s = scaleRef.current || 1;
    const r = 14 / s;
    for (const n of notes) {
      if (Math.abs(n.x - x) <= r && Math.abs(n.y - y) <= r) return n;
    }
    return null;
  }

  async function handleTap(x: number, y: number) {
    if (noteMode) {
      setNewNoteAt({ x, y });
      setNoteMode(false);
      return;
    }
    // Tap on existing note → open editor
    const n = hitNote(x, y);
    if (n) {
      setEditingNote(n);
      return;
    }
    for (const p of points) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 12) return;
    }
    setPending({ x, y });
    if (isBasePointCapture) setBpPromptOpen(true);
  }


  async function submitValue(v: number) {
    if (editingPoint) {
      const updated: SurveyPoint = { ...editingPoint, value: v };
      await savePoint(updated);
      onPointsChange(points.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPoint(null);
      return;
    }
    if (!pending) return;
    const isBP = isBasePointCapture;
    const point: SurveyPoint = {
      id: uid(),
      floorId: floor.id,
      index: nextIndex,
      x: pending.x,
      y: pending.y,
      value: v,
      isBasePoint: isBP,
      label: isBP ? "BP1" : undefined,
      createdAt: Date.now(),
    };
    await savePoint(point);
    onPointsChange([...points, point]);
    setPending(null);
    setBpPromptOpen(false);
  }

  function hitPoint(x: number, y: number): { point: SurveyPoint; on: "dot" | "label" } | null {
    const s = scaleRef.current || 1;
    const dotHit = 14 / s;
    for (const p of points) {
      if (Math.hypot(p.x - x, p.y - y) < dotHit) return { point: p, on: "dot" };
    }
    const fontPx = 12;
    const pad = 4 / s;
    for (const p of points) {
      const text = p.value.toFixed(2);
      const w = text.length * fontPx * 0.62;
      const h = fontPx + 2;
      const lx = p.x + pointSize + 4;
      const ly = p.y + pointSize + 3;
      if (x >= lx - pad && x <= lx + w + pad && y >= ly - pad && y <= ly + h + pad) {
        return { point: p, on: "label" };
      }
    }
    return null;
  }

  async function undoLast() {
    const last = points[points.length - 1];
    if (!last) return;
    await deletePoint(last.id);
    onPointsChange(points.slice(0, -1));
  }

  const keypadTitle = editingPoint
    ? `Edit point #${editingPoint.index}`
    : isBasePointCapture
      ? "Base Point value (BP1)"
      : `Point #${nextIndex}`;

  return (
    <div className="flex flex-col h-full relative">
      {/* Floating status chip (top-left, offset for note tool) */}
      <div className="absolute top-2 left-14 z-30 flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border shadow-sm px-2.5 py-1 text-xs">
        <span className="font-medium">{points.length}</span>
        <span className="text-muted-foreground">pts</span>
        {points.length > 0 && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">next</span>
            <span className="font-mono font-medium">#{nextIndex}</span>
          </>
        )}
      </div>

      {/* Note tool (top-left corner) */}
      <button
        onClick={() => setNoteMode((v) => !v)}
        aria-label={noteMode ? "Cancel note placement" : "Add note"}
        aria-pressed={noteMode}
        className={
          "absolute top-2 left-2 z-30 h-9 w-9 rounded-full backdrop-blur border shadow-sm flex items-center justify-center " +
          (noteMode ? "bg-amber-400 text-amber-950 border-amber-500" : "bg-background/90 hover:bg-background")
        }
      >
        <StickyNote className="h-4 w-4" />
      </button>

      {/* Floating Undo (top-right) */}
      <button
        onClick={undoLast}
        disabled={points.length === 0}
        aria-label="Undo last point"
        className="absolute top-2 right-2 z-30 h-9 w-9 rounded-full bg-background/90 backdrop-blur border shadow-sm flex items-center justify-center disabled:opacity-40 hover:bg-background"
      >
        <Undo2 className="h-4 w-4" />
      </button>

      {/* Note mode hint */}
      {noteMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs px-3 py-1 shadow-sm">
          Tap the plan to drop a note
        </div>
      )}

      {/* Dismissible boundary warning */}
      {floor.boundary.length < 3 && !warningDismissed && (
        <div className="absolute top-14 left-2 right-2 z-20 rounded-lg bg-amber-50/95 backdrop-blur border border-amber-200 text-amber-900 text-xs px-3 py-2 shadow-sm flex items-start gap-2">
          <span className="flex-1">Draw a boundary in Setup → Boundary before collecting points.</span>
          <button
            onClick={() => setWarningDismissed(true)}
            className="text-amber-700 hover:text-amber-900 shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}


      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        onTap={handleTap}
        onTransform={(t) => { scaleRef.current = t.scale; }}
        onImagePointerDown={(x, y, event) => {
          // In note mode, defer to onTap (handleTap will drop the note).
          if (noteMode) return false;
          // Tapping an existing note takes precedence over point-drag.
          if (hitNote(x, y)) return false;
          const hit = hitPoint(x, y);
          if (!hit) return false;
          const { point: hp } = hit;
          setSelectedIds(new Set([hp.id]));
          const drag: DragState = {
            id: hp.id,
            moved: false,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startImgX: x,
            startImgY: y,
            origX: hp.x,
            origY: hp.y,
            lastX: hp.x,
            lastY: hp.y,
          };
          dragRef.current = drag;
          setDragging(drag);
          return true;
        }}

        onImagePointerMove={(x, y, event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const screenDist = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
          if (!drag.moved && screenDist < 18) return;
          const nx = drag.origX + (x - drag.startImgX);
          const ny = drag.origY + (y - drag.startImgY);
          const nextDrag = { ...drag, moved: true, lastX: nx, lastY: ny };
          dragRef.current = nextDrag;
          setDragging(nextDrag);
          onPointsChange(points.map((p) => (p.id === nextDrag.id ? { ...p, x: nx, y: ny } : p)));
        }}
        onImagePointerCancel={() => {
          dragRef.current = null;
          setDragging(null);
        }}
        onImagePointerUp={async (x, y, _event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const point = points.find((p) => p.id === drag.id);
          const moved = drag.moved;
          const finalX = drag.lastX ?? x;
          const finalY = drag.lastY ?? y;
          dragRef.current = null;
          setDragging(null);
          if (!point) return;
          if (!moved) {
            setEditingPoint(point);
            return;
          }
          const updated = { ...point, x: finalX, y: finalY };
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
            const color = p.isBasePoint ? "#16a34a" : "#dc2626";
            ctx.beginPath();
            ctx.arc(p.x, p.y, pointSize, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            if (sel) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, Math.max(12, pointSize + 8), 0, Math.PI * 2);
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            ctx.fillStyle = "#111827";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(p.value.toFixed(2), p.x + pointSize + 4, p.y + pointSize + 3);
          }
          // pending marker
          if (pending) {
            ctx.beginPath();
            ctx.arc(pending.x, pending.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = "#dc2626";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          // notes: small amber pin with first line of text next to it
          for (const n of notes) {
            const size = 12;
            ctx.fillStyle = "#fbbf24";
            ctx.strokeStyle = "#78350f";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(n.x - size / 2, n.y - size / 2, size, size);
            ctx.fill();
            ctx.stroke();
            // preview of first line, truncated
            const firstLine = n.text.split("\n")[0].slice(0, 32);
            if (firstLine) {
              ctx.font = "600 11px sans-serif";
              const tw = ctx.measureText(firstLine).width;
              const tx = n.x + size / 2 + 4;
              const ty = n.y - 8;
              ctx.fillStyle = "rgba(255,251,235,0.92)";
              ctx.fillRect(tx - 2, ty - 1, tw + 4, 14);
              ctx.strokeStyle = "rgba(120,53,15,0.35)";
              ctx.strokeRect(tx - 2, ty - 1, tw + 4, 14);
              ctx.fillStyle = "#78350f";
              ctx.textAlign = "left";
              ctx.textBaseline = "top";
              ctx.fillText(firstLine, tx, ty + 1);
            }
          }
        }}

      />

      <NumericKeypad
        open={(!!pending && !bpPromptOpen) || !!editingPoint}
        initialValue={
          editingPoint
            ? editingPoint.value
            : isBasePointCapture
              ? 9.0
              : undefined
        }
        repeatValue={
          !editingPoint && !isBasePointCapture
            ? points[points.length - 1]?.value
            : undefined
        }
        title={keypadTitle}
        subtitle="Inches. Positive = higher, negative = lower."
        onClose={() => { setPending(null); setEditingPoint(null); }}
        onSubmit={submitValue}
        onDelete={editingPoint ? async () => {
          const p = editingPoint;
          setEditingPoint(null);
          await deletePoint(p.id);
          onPointsChange(points.filter((x) => x.id !== p.id));
        } : undefined}
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

      <DataPointsPanel
        projectId={projectId}
        points={points}
        selectedIds={selectedIds}
        pointSize={pointSize}
        onPointSizeChange={setPointSize}
        onSelect={(id, additive) => {
          if (additive) {
            const next = new Set(selectedIds);
            next.has(id) ? next.delete(id) : next.add(id);
            setSelectedIds(next);
          } else {
            setSelectedIds(new Set([id]));
          }
        }}
      />
    </div>
  );
}
