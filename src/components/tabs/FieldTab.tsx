import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";
import { PlanCanvas, type CanvasTransform } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { NoteOverlay } from "../NoteOverlay";

import { Button } from "@/components/ui/button";

import type { Floor, SurveyPoint } from "@/lib/types";
import { savePoint, deletePoint, reindexFloorPoints, uid } from "@/lib/db";
import {
  loadNotePins,
  saveNotePins,
  reindexNotePins,
  newNotePinId,
  type NotePin,
} from "@/lib/notePins";
import type { FloorSnapshot } from "@/lib/useFloorHistory";

interface Props {
  projectId: string;
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  pointSize: number;
  pointColor: string;
  focusRequest?: { x: number; y: number; nonce: number };
  onCommit?: (snap: FloorSnapshot) => void;
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

export function FieldTab({ projectId, floor, points, onPointsChange, selectedIds, setSelectedIds, pointSize, pointColor, focusRequest, onCommit }: Props) {

  const scaleRef = useRef(1);
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, tx: 0, ty: 0 });
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Note pins
  const [noteMode, setNoteMode] = useState(false);
  const [notePins, setNotePins] = useState<NotePin[]>([]);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setNotePins(loadNotePins(floor.id));
    setOpenNoteId(null);
  }, [floor.id]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function commitNotes(next: NotePin[]) {
    setNotePins(next);
    saveNotePins(floor.id, next);
  }

  function commitSnap(nextPoints: SurveyPoint[]) {
    onCommit?.({ points: nextPoints });
  }


  // Silence unused-var when dragging state isn't read directly in render.
  void dragging;

  const nextIndex = (points[points.length - 1]?.index ?? 0) + 1;
  const isBasePointCapture = points.length === 0;

  function hitNotePin(x: number, y: number): NotePin | null {
    const s = scaleRef.current || 1;
    const r = 16 / s;
    for (let i = notePins.length - 1; i >= 0; i--) {
      const p = notePins[i];
      if (Math.hypot(p.x - x, p.y - y) < r) return p;
    }
    return null;
  }

  async function handleTap(x: number, y: number) {
    // Note pins always tappable — open the card.
    const noteHit = hitNotePin(x, y);
    if (noteHit) {
      setOpenNoteId(noteHit.id);
      return;
    }
    if (noteMode) {
      const pin: NotePin = {
        id: newNotePinId(),
        x,
        y,
        index: notePins.length + 1,
        text: "",
        createdAt: Date.now(),
      };
      const next = [...notePins, pin];
      commitNotes(next);
      setOpenNoteId(pin.id);
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
      const nextPts = points.map((p) => (p.id === updated.id ? updated : p));
      onPointsChange(nextPts);
      commitSnap(nextPts);
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
    const nextPts = [...points, point];
    onPointsChange(nextPts);
    commitSnap(nextPts);
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
    const reindexed = await reindexFloorPoints(floor.id);
    onPointsChange(reindexed);
  }

  const keypadTitle = editingPoint
    ? `Edit point #${editingPoint.index}`
    : isBasePointCapture
      ? "Base Point value (BP1)"
      : `Point #${nextIndex}`;

  const openNote = notePins.find((p) => p.id === openNoteId) || null;

  return (
    <div ref={containerRef} className="flex flex-col h-full relative">

      {/* Note-mode toggle pill */}
      <button
        type="button"
        onClick={() => setNoteMode((v) => !v)}
        aria-pressed={noteMode}
        className={
          "absolute top-2 right-2 z-20 h-9 px-3 rounded-full text-xs font-semibold shadow-sm border flex items-center gap-1.5 " +
          (noteMode
            ? "bg-amber-500 text-white border-amber-600"
            : "bg-white/90 backdrop-blur text-amber-900 border-amber-300")
        }
      >
        <StickyNote className="w-3.5 h-3.5" />
        {noteMode ? "Placing note" : "Note"}
      </button>


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
        focusRequest={focusRequest}
        onTap={handleTap}
        onTransform={(t) => { scaleRef.current = t.scale; setTransform(t); }}
        onImagePointerDown={(x, y, event) => {
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
          const nextPts = points.map((p) => (p.id === updated.id ? updated : p));
          onPointsChange(nextPts);
          commitSnap(nextPts);
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
            const color = p.isBasePoint ? "#16a34a" : pointColor;
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
          // note pins (orange, numbered)
          const s = scaleRef.current || 1;
          const rNote = Math.max(7, 9 / s);
          for (const n of notePins) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, rNote, 0, Math.PI * 2);
            ctx.fillStyle = "#f59e0b";
            ctx.fill();
            ctx.strokeStyle = "#78350f";
            ctx.lineWidth = 1.5 / s;
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${Math.max(9, 11 / s)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(n.index), n.x, n.y + 0.5 / s);
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
          const reindexed = await reindexFloorPoints(floor.id);
          onPointsChange(reindexed);
          commitSnap(reindexed);
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

    </div>
  );
}
