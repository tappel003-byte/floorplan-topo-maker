import { useEffect, useRef, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { NoteEditor } from "../NoteEditor";

import { Button } from "@/components/ui/button";

import type { Floor, SurveyNote, SurveyPoint } from "@/lib/types";
import {
  savePoint,
  deletePoint,
  reindexFloorPoints,
  uid,
  listNotes,
  saveNote,
  deleteNote,
} from "@/lib/db";

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

type NoteGesture = {
  id: string;
  startClientX: number;
  startClientY: number;
  startImgX: number;
  startImgY: number;
  origX: number;
  origY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  dragging: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
};

const NOTE_PIN_R = 9; // pin head radius (image px at 1x); tuned to feel finger-sized
const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 500;

export function FieldTab({ projectId, floor, points, onPointsChange, selectedIds, setSelectedIds, pointSize, pointColor, focusRequest }: Props) {

  const scaleRef = useRef(1);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Notes
  const [notes, setNotes] = useState<SurveyNote[]>([]);
  const [placingNote, setPlacingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<SurveyNote | null>(null);
  const noteGestureRef = useRef<NoteGesture | null>(null);
  const lastNoteTapRef = useRef<{ id: string; t: number } | null>(null);
  void projectId;


  // Silence unused-var when dragging state isn't read directly in render.
  void dragging;

  // Load notes when floor changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listNotes(floor.id);
      if (!cancelled) setNotes(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [floor.id]);

  // Listen for "add note" from the top-right icon
  useEffect(() => {
    const handler = () => setPlacingNote((v) => !v);
    window.addEventListener("app:add-note", handler);
    return () => window.removeEventListener("app:add-note", handler);
  }, []);

  const nextIndex = (points[points.length - 1]?.index ?? 0) + 1;
  const isBasePointCapture = points.length === 0;

  async function handleTap(x: number, y: number) {
    // If placing a note, this tap drops the pin and opens the editor.
    if (placingNote) {
      const note: SurveyNote = {
        id: uid(),
        floorId: floor.id,
        x,
        y,
        text: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveNote(note);
      setNotes((prev) => [...prev, note]);
      setPlacingNote(false);
      setEditingNote(note);
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

  function hitNote(x: number, y: number): SurveyNote | null {
    const s = scaleRef.current || 1;
    const r = Math.max(NOTE_PIN_R, 14 / s);
    // iterate in reverse so newest (top-most) wins
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
  void undoLast;

  const keypadTitle = editingPoint
    ? `Edit point #${editingPoint.index}`
    : isBasePointCapture
      ? "Base Point value (BP1)"
      : `Point #${nextIndex}`;

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

      {placingNote && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs px-3 py-1 shadow-sm flex items-center gap-2">
          <span>Tap a spot to drop a note</span>
          <button
            onClick={() => setPlacingNote(false)}
            className="text-amber-700 hover:text-amber-900"
            aria-label="Cancel"
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
        onTransform={(t) => { scaleRef.current = t.scale; }}
        onImagePointerDown={(x, y, event) => {
          // Notes first — pins should intercept even if a point sits nearby.
          const hn = hitNote(x, y);
          if (hn) {
            const g: NoteGesture = {
              id: hn.id,
              startClientX: event.clientX,
              startClientY: event.clientY,
              startImgX: x,
              startImgY: y,
              origX: hn.x,
              origY: hn.y,
              lastX: hn.x,
              lastY: hn.y,
              moved: false,
              dragging: false,
              longPressTimer: null,
            };
            g.longPressTimer = setTimeout(() => {
              g.dragging = true;
            }, LONG_PRESS_MS);
            noteGestureRef.current = g;
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
          const ng = noteGestureRef.current;
          if (ng) {
            const dist = Math.hypot(event.clientX - ng.startClientX, event.clientY - ng.startClientY);
            if (dist > 6) ng.moved = true;
            if (!ng.dragging) return;
            const nx = ng.origX + (x - ng.startImgX);
            const ny = ng.origY + (y - ng.startImgY);
            ng.lastX = nx;
            ng.lastY = ny;
            setNotes((prev) => prev.map((n) => (n.id === ng.id ? { ...n, x: nx, y: ny } : n)));
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
          const ng = noteGestureRef.current;
          if (ng?.longPressTimer) clearTimeout(ng.longPressTimer);
          noteGestureRef.current = null;
          dragRef.current = null;
          setDragging(null);
        }}
        onImagePointerUp={async (x, y, _event) => {
          void x; void y;
          const ng = noteGestureRef.current;
          if (ng) {
            if (ng.longPressTimer) clearTimeout(ng.longPressTimer);
            noteGestureRef.current = null;
            if (ng.dragging) {
              // finalize drag
              const n = notes.find((nn) => nn.id === ng.id);
              if (n) await saveNote({ ...n, x: ng.lastX, y: ng.lastY });
              lastNoteTapRef.current = null;
              return;
            }
            if (ng.moved) {
              lastNoteTapRef.current = null;
              return;
            }
            // Tap-count for double-tap detection
            const now = performance.now();
            const prev = lastNoteTapRef.current;
            if (prev && prev.id === ng.id && now - prev.t < DOUBLE_TAP_MS) {
              lastNoteTapRef.current = null;
              const n = notes.find((nn) => nn.id === ng.id);
              if (n) setEditingNote(n);
            } else {
              lastNoteTapRef.current = { id: ng.id, t: now };
            }
            return;
          }
          const drag = dragRef.current;
          if (!drag) return;
          const point = points.find((p) => p.id === drag.id);
          const moved = drag.moved;
          const finalX = drag.lastX;
          const finalY = drag.lastY;
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
          // notes (pin flags)
          const s = scaleRef.current || 1;
          for (const n of notes) {
            // pin: tapered stem + circular head
            const r = NOTE_PIN_R;
            const stemH = r * 1.8;
            ctx.save();
            // stem (triangle) from tip to base of head
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n.x - r * 0.55, n.y - stemH);
            ctx.lineTo(n.x + r * 0.55, n.y - stemH);
            ctx.closePath();
            ctx.fillStyle = "#f59e0b";
            ctx.strokeStyle = "#78350f";
            ctx.lineWidth = 1 / s;
            ctx.fill();
            ctx.stroke();
            // head
            ctx.beginPath();
            ctx.arc(n.x, n.y - stemH - r * 0.35, r, 0, Math.PI * 2);
            ctx.fillStyle = "#f59e0b";
            ctx.fill();
            ctx.stroke();
            // note glyph inside head
            ctx.fillStyle = "#78350f";
            ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("!", n.x, n.y - stemH - r * 0.35);
            ctx.restore();
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

      {/* Note editor */}
      {editingNote && (
        <NoteEditor
          note={editingNote}
          onClose={() => setEditingNote(null)}
          onSave={async (text) => {
            const updated: SurveyNote = { ...editingNote, text, updatedAt: Date.now() };
            await saveNote(updated);
            setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
            setEditingNote(null);
          }}
          onDelete={async () => {
            const id = editingNote.id;
            await deleteNote(id);
            setNotes((prev) => prev.filter((n) => n.id !== id));
            setEditingNote(null);
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
