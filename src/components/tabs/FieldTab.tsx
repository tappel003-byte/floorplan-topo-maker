import { useEffect, useRef, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { NoteDialog } from "../NoteDialog";

import { Button } from "@/components/ui/button";

import type { Floor, NotePin, SurveyPoint } from "@/lib/types";
import { savePoint, deletePoint, reindexFloorPoints, saveFloor, uid } from "@/lib/db";
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
  notesVersion?: number;
  onCommit?: (snap: FloorSnapshot) => void;
  onFloorNotesChange?: (notePins: NotePin[]) => void;
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

type PinGesture = {
  id: string;
  startClientX: number;
  startClientY: number;
  startImgX: number;
  startImgY: number;
  origX: number;
  origY: number;
  lastX: number;
  lastY: number;
  dragMode: boolean;   // becomes true after long-press
  moved: boolean;
  longPressTimer: number | null;
  downAt: number;
};

const LONG_PRESS_MS = 400;
const DOUBLE_TAP_MS = 350;
const PIN_HIT_RADIUS = 18;

export function FieldTab({ projectId, floor, points, onPointsChange, selectedIds, setSelectedIds, pointSize, pointColor, focusRequest, notesVersion, onCommit, onFloorNotesChange }: Props) {

  const scaleRef = useRef(1);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // --- Note pins ---
  const [notes, setNotes] = useState<NotePin[]>(floor.notePins ?? []);
  const [armed, setArmed] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const pinGestureRef = useRef<PinGesture | null>(null);
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    setNotes(floor.notePins ?? []);
  }, [floor.id, notesVersion]);

  useEffect(() => {
    function onAdd() { setArmed(true); }
    window.addEventListener("app:add-note", onAdd);
    return () => window.removeEventListener("app:add-note", onAdd);
  }, []);

  async function persistNotes(next: NotePin[]) {
    setNotes(next);
    await saveFloor({ ...floor, notePins: next });
    onFloorNotesChange?.(next);
  }

  function commitSnap(nextPoints: SurveyPoint[], nextNotes: NotePin[]) {
    onCommit?.({ points: nextPoints, notePins: nextNotes });
  }


  // Silence unused-var when dragging state isn't read directly in render.
  void dragging;

  const nextIndex = (points[points.length - 1]?.index ?? 0) + 1;
  const isBasePointCapture = points.length === 0;

  async function handleTap(x: number, y: number) {
    if (armed) {
      const idx = (notes[notes.length - 1]?.index ?? 0) + 1;
      const pin: NotePin = { id: uid(), index: idx, x, y, text: "", createdAt: Date.now() };
      const next = [...notes, pin];
      await persistNotes(next);
      commitSnap(points, next);
      setArmed(false);
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
      commitSnap(nextPts, notes);
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

  function hitPin(x: number, y: number): NotePin | null {
    const s = scaleRef.current || 1;
    const r = PIN_HIT_RADIUS / s;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (Math.hypot(n.x - x, n.y - y) < r) return n;
    }
    return null;

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

  const openNote = openNoteId ? notes.find((n) => n.id === openNoteId) ?? null : null;

  return (
    <div className="flex flex-col h-full relative">

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

      {armed && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 rounded-full bg-amber-500 text-white text-xs px-3 py-1.5 shadow-md flex items-center gap-2">
          <span>Tap the plan to drop a note</span>
          <button onClick={() => setArmed(false)} className="opacity-90 hover:opacity-100" aria-label="Cancel">✕</button>
        </div>
      )}

      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        focusRequest={focusRequest}
        onTap={handleTap}
        onTransform={(t) => { scaleRef.current = t.scale; }}
        onImagePointerDown={(x, y, event) => {
          // Note pin first (drawn on top → higher priority)
          const np = hitPin(x, y);
          if (np) {
            const g: PinGesture = {
              id: np.id,
              startClientX: event.clientX,
              startClientY: event.clientY,
              startImgX: x,
              startImgY: y,
              origX: np.x,
              origY: np.y,
              lastX: np.x,
              lastY: np.y,
              dragMode: false,
              moved: false,
              longPressTimer: null,
              downAt: performance.now(),
            };
            g.longPressTimer = window.setTimeout(() => {
              const cur = pinGestureRef.current;
              if (cur && cur.id === np.id && !cur.moved) {
                cur.dragMode = true;
              }
            }, LONG_PRESS_MS);
            pinGestureRef.current = g;
            return true;
          }
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
          const g = pinGestureRef.current;
          if (g) {
            const dist = Math.hypot(event.clientX - g.startClientX, event.clientY - g.startClientY);
            if (dist > 6) g.moved = true;
            if (!g.dragMode) return; // ignore movement until long-press promotes to drag
            const nx = g.origX + (x - g.startImgX);
            const ny = g.origY + (y - g.startImgY);
            g.lastX = nx; g.lastY = ny;
            setNotes((list) => list.map((n) => (n.id === g.id ? { ...n, x: nx, y: ny } : n)));
            return;
          }
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
          const g = pinGestureRef.current;
          if (g) {
            if (g.longPressTimer !== null) window.clearTimeout(g.longPressTimer);
            // Revert visual to persisted state
            setNotes(floor.notePins ?? notes);
            pinGestureRef.current = null;
          }
          dragRef.current = null;
          setDragging(null);
        }}
        onImagePointerUp={async (x, y, _event) => {
          const g = pinGestureRef.current;
          if (g) {
            if (g.longPressTimer !== null) window.clearTimeout(g.longPressTimer);
            pinGestureRef.current = null;
            if (g.dragMode && g.moved) {
              const next = notes.map((n) => (n.id === g.id ? { ...n, x: g.lastX, y: g.lastY } : n));
              await persistNotes(next);
              lastTapRef.current = null;
              return;
            }
            // Treat as tap → double-tap detection
            const now = performance.now();
            const prev = lastTapRef.current;
            if (prev && prev.id === g.id && now - prev.at < DOUBLE_TAP_MS) {
              lastTapRef.current = null;
              setOpenNoteId(g.id);
            } else {
              lastTapRef.current = { id: g.id, at: now };
            }
            return;
          }
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
          // note pins (drawn above points so they are always tappable)
          const s = scaleRef.current || 1;
          const pinR = 9 / s;
          for (const n of notes) {
            // shadow
            ctx.beginPath();
            ctx.arc(n.x, n.y, pinR, 0, Math.PI * 2);
            ctx.fillStyle = "#f59e0b";
            ctx.fill();
            ctx.lineWidth = 1.5 / s;
            ctx.strokeStyle = "#78350f";
            ctx.stroke();
            // "N" glyph
            ctx.fillStyle = "#78350f";
            ctx.font = `bold ${11 / s}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(n.index), n.x, n.y + 0.5 / s);
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
        } : undefined}
      />

      {openNote && (
        <NoteDialog
          key={openNote.id}
          pin={openNote}
          onClose={() => setOpenNoteId(null)}
          onSave={async (text) => {
            const next = notes.map((n) => (n.id === openNote.id ? { ...n, text } : n));
            await persistNotes(next);
          }}
          onDelete={async () => {
            if (!confirm(`Delete note N${openNote.index}?`)) return;
            const next = notes
              .filter((n) => n.id !== openNote.id)
              .map((n, i) => ({ ...n, index: i + 1 }));
            await persistNotes(next);
            setOpenNoteId(null);
          }}
        />
      )}

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
