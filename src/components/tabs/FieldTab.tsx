import { useEffect, useRef, useState } from "react";
import { PlanCanvas, type CanvasTransform } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";

import { Button } from "@/components/ui/button";
import { StickyNote, Trash2 } from "lucide-react";

import type { Floor, NotePin, SurveyPoint } from "@/lib/types";
import { savePoint, deletePoint, reindexFloorPoints, saveFloor, uid } from "@/lib/db";
import type { FloorSnapshot } from "@/lib/useFloorHistory";

interface Props {
  projectId: string;
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  onFloorChange?: (floor: Floor) => void;
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
  startImgX: number;
  startImgY: number;
  origX: number;
  origY: number;
  lastX: number;
  lastY: number;
};

type NoteDragState = {
  id: string;
  moved: boolean;
  startClientX: number;
  startClientY: number;
  startImgX: number;
  startImgY: number;
  origX: number;
  origY: number;
  longPressAt: number;
  active: boolean; // becomes true after long-press fires
};

const NOTE_RADIUS = 11; // image-space radius for note pin hit / draw
const NOTE_COLOR = "#f97316"; // orange-500
const LONG_PRESS_MS = 380;

export function FieldTab({ projectId, floor, points, onPointsChange, onFloorChange, selectedIds, setSelectedIds, pointSize, pointColor, focusRequest, onCommit }: Props) {
  void projectId;
  const scaleRef = useRef(1);
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, tx: 0, ty: 0 });
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Notes state
  const [noteMode, setNoteMode] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const noteDragRef = useRef<NoteDragState | null>(null);
  const lastNoteTapRef = useRef<{ id: string; at: number } | null>(null);
  const [, setNoteDragTick] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);

  const notes: NotePin[] = floor.notes ?? [];

  useEffect(() => {
    setPending(null);
    setEditingPoint(null);
    setEditingNoteId(null);
    setNoteMode(false);
  }, [floor.id]);

  function commitSnap(nextPoints: SurveyPoint[]) {
    onCommit?.({ points: nextPoints });
  }

  async function persistNotes(next: NotePin[]) {
    const nextFloor: Floor = { ...floor, notes: next };
    await saveFloor(nextFloor);
    onFloorChange?.(nextFloor);
  }

  void dragging;

  const nextIndex = (points[points.length - 1]?.index ?? 0) + 1;
  const isBasePointCapture = points.length === 0;

  function hitNote(x: number, y: number): NotePin | null {
    const s = scaleRef.current || 1;
    const r = NOTE_RADIUS + 6 / s;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (Math.hypot(n.x - x, n.y - y) < r) return n;
    }
    return null;
  }

  function openNoteEditor(n: NotePin) {
    setEditingNoteId(n.id);
    setNoteDraft(n.text);
  }

  async function handleTap(x: number, y: number) {
    // Note mode: tap empty spot creates a new pin + opens editor
    if (noteMode) {
      const hit = hitNote(x, y);
      if (hit) {
        openNoteEditor(hit);
        return;
      }
      const pin: NotePin = { id: uid(), x, y, text: "" };
      const next = [...notes, pin];
      await persistNotes(next);
      return;
    }
    // Normal mode: place a survey point (ignore taps on note pins so they don't collide)
    if (hitNote(x, y)) return;
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

  const keypadTitle = editingPoint
    ? `Edit point #${editingPoint.index}`
    : isBasePointCapture
      ? "Base Point value (BP1)"
      : `Point #${nextIndex}`;

  // Editor screen position (from image coords → wrapper coords)
  const editingNote = editingNoteId ? notes.find((n) => n.id === editingNoteId) : null;
  const editorScreen = editingNote
    ? { x: editingNote.x * transform.scale + transform.tx, y: editingNote.y * transform.scale + transform.ty }
    : null;

  async function saveNoteEditor() {
    if (!editingNote) return;
    const next = notes.map((n) => (n.id === editingNote.id ? { ...n, text: noteDraft } : n));
    await persistNotes(next);
    setEditingNoteId(null);
  }

  async function deleteNote(id: string) {
    const next = notes.filter((n) => n.id !== id);
    await persistNotes(next);
    setEditingNoteId(null);
  }

  return (
    <div className="flex flex-col h-full relative">

      {/* Dismissible boundary warning */}
      {floor.boundary.length < 3 && !warningDismissed && (
        <div className="absolute top-2 left-2 right-2 z-20 rounded-lg bg-amber-50/95 backdrop-blur border border-amber-200 text-amber-900 text-xs px-3 py-2 shadow-sm flex items-start gap-2">
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

      {/* Notes mode toggle chip — floats above canvas, below top bar */}
      <button
        onClick={() => { setNoteMode((v) => !v); setEditingNoteId(null); }}
        className={`absolute z-20 bottom-20 right-3 rounded-full shadow-md px-3 py-2 text-xs font-medium flex items-center gap-1.5 border transition-colors ${
          noteMode
            ? "bg-orange-500 text-white border-orange-600"
            : "bg-white/95 text-gray-700 border-gray-300 hover:bg-white"
        }`}
        aria-pressed={noteMode}
      >
        <StickyNote className="w-3.5 h-3.5" />
        {noteMode ? "Notes on" : "Notes"}
      </button>

      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        focusRequest={focusRequest}
        onTap={handleTap}
        onTransform={(t) => { scaleRef.current = t.scale; setTransform(t); }}
        onImagePointerDown={(x, y, event) => {
          // Note pin takes priority (both modes) — supports long-press-drag and tap-to-open
          const note = hitNote(x, y);
          if (note) {
            const drag: NoteDragState = {
              id: note.id,
              moved: false,
              startClientX: event.clientX,
              startClientY: event.clientY,
              startImgX: x,
              startImgY: y,
              origX: note.x,
              origY: note.y,
              longPressAt: Date.now() + LONG_PRESS_MS,
              active: false,
            };
            noteDragRef.current = drag;
            setNoteDragTick((t) => t + 1);
            if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = window.setTimeout(() => {
              const d = noteDragRef.current;
              if (d && !d.moved) {
                d.active = true;
                setNoteDragTick((t) => t + 1);
              }
            }, LONG_PRESS_MS);
            return true;
          }
          if (noteMode) return false; // in note mode, empty taps handled via onTap
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
          const nd = noteDragRef.current;
          if (nd) {
            const screenDist = Math.hypot(event.clientX - nd.startClientX, event.clientY - nd.startClientY);
            if (screenDist > 8) nd.moved = true;
            if (!nd.active) return; // must long-press first to start moving
            const nx = nd.origX + (x - nd.startImgX);
            const ny = nd.origY + (y - nd.startImgY);
            const next = notes.map((n) => (n.id === nd.id ? { ...n, x: nx, y: ny } : n));
            // optimistic local render via floor prop callback
            onFloorChange?.({ ...floor, notes: next });
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
          dragRef.current = null;
          setDragging(null);
          if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
          noteDragRef.current = null;
          setNoteDragTick((t) => t + 1);
        }}
        onImagePointerUp={async (x, y, _event) => {
          const nd = noteDragRef.current;
          if (nd) {
            if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
            noteDragRef.current = null;
            setNoteDragTick((t) => t + 1);
            if (nd.active) {
              // committed a move — persist
              const moved = notes.map((n) => (n.id === nd.id ? { ...n, x: nd.origX + (x - nd.startImgX), y: nd.origY + (y - nd.startImgY) } : n));
              await persistNotes(moved);
            } else if (!nd.moved) {
              // Double-tap on pin → open editor. Single tap does nothing so
              // dropping/selecting notes never focuses a text field or shifts iOS viewport.
              const now = Date.now();
              const last = lastNoteTapRef.current;
              if (last?.id === nd.id && now - last.at < 360) {
                lastNoteTapRef.current = null;
                const note = notes.find((n) => n.id === nd.id);
                if (note) openNoteEditor(note);
              } else {
                lastNoteTapRef.current = { id: nd.id, at: now };
              }
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
          const nextPts = points.map((p) => (p.id === updated.id ? updated : p));
          onPointsChange(nextPts);
          commitSnap(nextPts);
        }}
        drawOverlay={(ctx) => {
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
          // Note pins (drawn on top of points visually is fine; they're field-only)
          for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            const r = NOTE_RADIUS;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = NOTE_COLOR;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(i + 1), n.x, n.y + 0.5);
          }
          if (pending) {
            ctx.beginPath();
            ctx.arc(pending.x, pending.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = "#dc2626";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }}
      />

      {/* Inline note editor — absolutely positioned inside FieldTab, NO fullscreen backdrop */}
      {editingNote && editorScreen && (
        <div
          className="absolute z-30 w-64 rounded-xl bg-white shadow-2xl border border-gray-200 p-3"
          style={{
            left: Math.max(8, Math.min(editorScreen.x + 16, (wrapWidth() ?? 400) - 264)),
            top: Math.max(8, Math.min(editorScreen.y - 40, (wrapHeight() ?? 600) - 200)),
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Note {notes.findIndex((n) => n.id === editingNote.id) + 1}
            </span>
            <button
              onClick={() => deleteNote(editingNote.id)}
              className="text-gray-400 hover:text-red-600 p-1"
              aria-label="Delete note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Type or dictate…"
            className="w-full min-h-[90px] text-base border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingNoteId(null)}>Cancel</Button>
            <Button size="sm" onClick={saveNoteEditor}>Save</Button>
          </div>
        </div>
      )}

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

// Best-effort viewport helpers so the editor card doesn't overflow the container.
function wrapWidth(): number | null {
  if (typeof window === "undefined") return null;
  return window.innerWidth;
}
function wrapHeight(): number | null {
  if (typeof window === "undefined") return null;
  return window.innerHeight;
}
