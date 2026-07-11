import { useEffect, useRef, useState } from "react";
import { PlanCanvas, type CanvasTransform } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { AddTransitionSheet } from "../AddTransitionSheet";
import { TransitionDetailDialog } from "../TransitionDetailDialog";

import { Button } from "@/components/ui/button";
import { Pencil, List, Trash2 } from "lucide-react";

import type { Floor, NotePin, SurveyPoint, Transition } from "@/lib/types";
import { savePoint, deletePoint, reindexFloorPoints, saveFloor, uid } from "@/lib/db";
import { transitionDelta, formatDelta } from "@/lib/transitions";
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

export function FieldTab({
  projectId,
  floor,
  points,
  onPointsChange,
  onFloorChange,
  selectedIds,
  setSelectedIds,
  pointSize,
  pointColor,
  focusRequest,
  onCommit,
}: Props) {
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
  const [notesListOpen, setNotesListOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteFocusReq, setNoteFocusReq] = useState<
    { x: number; y: number; nonce: number } | undefined
  >(undefined);
  const noteDragRef = useRef<NoteDragState | null>(null);
  const lastNoteTapRef = useRef<{ id: string; at: number } | null>(null);
  const [, setNoteDragTick] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);

  // Transitions state
  const [activeTransitionId, setActiveTransitionId] = useState<string | null>(null);
  const [addingTransition, setAddingTransition] = useState(false);
  const [viewingTransitionId, setViewingTransitionId] = useState<string | null>(null);

  const notes: NotePin[] = floor.notes ?? [];
  const transitions: Transition[] = floor.transitions ?? [];
  const activeTransition = activeTransitionId
    ? (transitions.find((t) => t.id === activeTransitionId) ?? null)
    : null;

  useEffect(() => {
    setPending(null);
    setEditingPoint(null);
    setEditingNoteId(null);
    setNoteMode(false);
    setActiveTransitionId(null);
    setViewingTransitionId(null);

  }, [floor.id]);

  function commitSnap(nextPoints: SurveyPoint[]) {
    onCommit?.({ points: nextPoints });
  }

  async function persistNotes(next: NotePin[]) {
    const nextFloor: Floor = { ...floor, notes: next };
    await saveFloor(nextFloor);
    onFloorChange?.(nextFloor);
  }

  async function persistTransitions(next: Transition[]) {
    const nextFloor: Floor = { ...floor, transitions: next };
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
      openNoteEditor(pin);
      setNoteMode(false);
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
      // Tag with active transition (BP never gets tagged)
      transitionId: !isBP && activeTransitionId ? activeTransitionId : undefined,
    };
    await savePoint(point);
    const nextPts = [...points, point];
    onPointsChange(nextPts);
    commitSnap(nextPts);
    setPending(null);
    setBpPromptOpen(false);
  }

  /** Called from AddTransitionSheet. Creates the transition record and plots the diamond anchor at the pending location. */
  async function handleAddTransition(data: {
    surfaceA: string;
    surfaceB: string;
    readingA: number;
    readingB: number;
  }) {
    if (!pending) return;
    const isBP = isBasePointCapture;
    const t: Transition = {
      id: uid(),
      x: pending.x,
      y: pending.y,
      surfaceA: data.surfaceA,
      surfaceB: data.surfaceB,
      readingA: data.readingA,
      readingB: data.readingB,
      createdAt: Date.now(),
    };
    // Anchor point uses readingA (reference-side value).
    const anchor: SurveyPoint = {
      id: uid(),
      floorId: floor.id,
      index: nextIndex,
      x: pending.x,
      y: pending.y,
      value: data.readingA,
      isBasePoint: isBP,
      label: isBP ? "BP1" : undefined,
      createdAt: Date.now(),
      transitionId: t.id,
      isTransitionAnchor: true,
    };
    await persistTransitions([...transitions, t]);
    await savePoint(anchor);
    const nextPts = [...points, anchor];
    onPointsChange(nextPts);
    commitSnap(nextPts);
    setPending(null);
    setBpPromptOpen(false);
    setAddingTransition(false);
    // Subsequent points on side B will be tagged with this transition.
    setActiveTransitionId(t.id);
  }

  /** Save edits from TransitionDetailDialog. Anchor's stored value follows readingA. */
  async function handleSaveTransition(updated: Transition) {
    const nextTs = transitions.map((t) => (t.id === updated.id ? updated : t));
    await persistTransitions(nextTs);
    // Keep the anchor's value in sync with readingA.
    const anchor = points.find((p) => p.transitionId === updated.id && p.isTransitionAnchor);
    if (anchor && anchor.value !== updated.readingA) {
      const nextAnchor = { ...anchor, value: updated.readingA };
      await savePoint(nextAnchor);
      const nextPts = points.map((p) => (p.id === nextAnchor.id ? nextAnchor : p));
      onPointsChange(nextPts);
      commitSnap(nextPts);
    }
    setViewingTransitionId(null);
  }

  /** Delete a transition. Removes the anchor point and detaches all downstream refs (raw values preserved). */
  async function handleDeleteTransition(id: string) {
    const nextTs = transitions.filter((t) => t.id !== id);
    await persistTransitions(nextTs);
    const anchorIds = points.filter((p) => p.transitionId === id && p.isTransitionAnchor).map((p) => p.id);
    for (const aid of anchorIds) await deletePoint(aid);
    // Detach downstream (strip tag; keep raw value).
    const kept = points.filter((p) => !anchorIds.includes(p.id));
    const detached = kept.map((p) =>
      p.transitionId === id ? { ...p, transitionId: undefined } : p,
    );
    for (const p of detached) {
      if (p.transitionId === undefined) await savePoint(p);
    }
    const reindexed = await reindexFloorPoints(floor.id);
    onPointsChange(reindexed);
    commitSnap(reindexed);
    if (activeTransitionId === id) setActiveTransitionId(null);
    setViewingTransitionId(null);
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

  // Editor screen position (from image coords → wrapper coords).
  // The card is placed offset from the pin so it never covers the dot.
  // Preferred: to the right of the pin. If not enough room, flip to the left.
  // Vertically: try to keep the card top a bit above the pin, but keep on screen.
  const editingNote = editingNoteId ? notes.find((n) => n.id === editingNoteId) : null;
  const CARD_W = 256; // matches w-64
  const CARD_H = 200; // approx height incl. padding + buttons
  const PIN_GAP = 18; // clearance between pin edge and card edge
  const editorScreen = editingNote
    ? (() => {
        const px = editingNote.x * transform.scale + transform.tx;
        const py = editingNote.y * transform.scale + transform.ty;
        const vw = wrapWidth() ?? 400;
        const vh = wrapHeight() ?? 600;
        const roomRight = vw - (px + PIN_GAP) - 8;
        const roomLeft = (px - PIN_GAP) - 8;
        let left: number;
        let top: number;
        if (roomRight >= CARD_W) {
          left = px + PIN_GAP;
          top = Math.max(8, Math.min(py - CARD_H / 2, vh - CARD_H - 8));
        } else if (roomLeft >= CARD_W) {
          left = px - PIN_GAP - CARD_W;
          top = Math.max(8, Math.min(py - CARD_H / 2, vh - CARD_H - 8));
        } else {
          // No horizontal room — place above or below the pin
          left = Math.max(8, Math.min(px - CARD_W / 2, vw - CARD_W - 8));
          const below = py + PIN_GAP;
          const above = py - PIN_GAP - CARD_H;
          top = below + CARD_H + 8 <= vh ? below : Math.max(8, above);
        }
        return { x: px, y: py, left, top };
      })()
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
          <span className="flex-1">
            Draw a boundary in Setup → Boundary before collecting points.
          </span>
          <button
            onClick={() => setWarningDismissed(true)}
            className="text-amber-700 hover:text-amber-900 shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Notes toolbar — horizontal pill, top-right, above canvas but below top bar */}
      <div className="absolute z-20 top-2 right-2 landscape-short:top-auto landscape-short:right-[calc(env(safe-area-inset-right)+0.75rem)] landscape-short:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] h-9 flex items-stretch rounded-full bg-white/95 backdrop-blur shadow-md border border-gray-300 overflow-hidden text-xs font-medium">
        <button
          onClick={() => {
            setNoteMode((v) => !v);
            setEditingNoteId(null);
            setNotesListOpen(false);
          }}
          className={`px-3 py-2 flex items-center gap-1.5 transition-colors ${
            noteMode ? "bg-orange-500 text-white" : "text-gray-700 hover:bg-gray-50"
          }`}
          aria-pressed={noteMode}
          aria-label="Toggle note mode"
        >
          <Pencil className="w-3.5 h-3.5" />
          {noteMode ? "Notes on" : "Note"}
        </button>
        <button
          onClick={() => {
            setNotesListOpen((v) => !v);
            setEditingNoteId(null);
          }}
          className={`px-3 py-2 flex items-center gap-1.5 border-l border-gray-200 transition-colors ${
            notesListOpen ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
          }`}
          aria-expanded={notesListOpen}
          aria-label="Show all notes"
        >
          <List className="w-3.5 h-3.5" />
          {notes.length}
        </button>
      </div>

      {/* Notes list dropdown */}
      {notesListOpen && (
        <div
          className="absolute z-30 top-12 right-2 w-64 max-h-[60vh] overflow-y-auto overscroll-contain rounded-xl bg-white shadow-2xl border border-gray-200"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              All Notes
            </span>
            <button
              onClick={() => setNotesListOpen(false)}
              className="text-gray-400 hover:text-gray-700 text-sm px-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {notes.length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center">
              No notes yet. Turn on Note mode and tap the plan to drop one.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notes.map((n, i) => (
                <li key={n.id} className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50">
                  <button
                    onClick={() => {
                      setNoteFocusReq({ x: n.x, y: n.y, nonce: Date.now() });
                      setNotesListOpen(false);
                    }}
                    className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center"
                    aria-label={`Center on note ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                  <button
                    onClick={() => {
                      openNoteEditor(n);
                      setNotesListOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left text-xs text-gray-700"
                  >
                    {n.text.trim() ? (
                      <span className="line-clamp-3 whitespace-pre-wrap">{n.text}</span>
                    ) : (
                      <span className="italic text-gray-400">(empty)</span>
                    )}
                  </button>
                  <button
                    onClick={() => deleteNote(n.id)}
                    className="shrink-0 text-gray-400 hover:text-red-600 p-1"
                    aria-label={`Delete note ${i + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        focusRequest={
          noteFocusReq && (!focusRequest || noteFocusReq.nonce > focusRequest.nonce)
            ? noteFocusReq
            : focusRequest
        }
        onTap={handleTap}
        onTransform={(t) => {
          scaleRef.current = t.scale;
          setTransform(t);
        }}
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
            const screenDist = Math.hypot(
              event.clientX - nd.startClientX,
              event.clientY - nd.startClientY,
            );
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
          const screenDist = Math.hypot(
            event.clientX - drag.startClientX,
            event.clientY - drag.startClientY,
          );
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
          if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          noteDragRef.current = null;
          setNoteDragTick((t) => t + 1);
        }}
        onImagePointerUp={async (x, y, _event) => {
          const nd = noteDragRef.current;
          if (nd) {
            if (longPressTimerRef.current) {
              window.clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            noteDragRef.current = null;
            setNoteDragTick((t) => t + 1);
            if (nd.active) {
              // committed a move — persist
              const moved = notes.map((n) =>
                n.id === nd.id
                  ? { ...n, x: nd.origX + (x - nd.startImgX), y: nd.origY + (y - nd.startImgY) }
                  : n,
              );
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
            // Tap on a diamond anchor opens the transition detail dialog,
            // not the numeric keypad. (Anchor's value is edited via readingA there.)
            if (point.isTransitionAnchor && point.transitionId) {
              setViewingTransitionId(point.transitionId);
              return;
            }
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
          for (const p of points) {
            const color = p.isBasePoint ? "#16a34a" : pointColor;
            const markerR = Math.max(pointSize, 2);
            const isAnchor = !!p.isTransitionAnchor;
            const linkedT = p.transitionId
              ? transitions.find((t) => t.id === p.transitionId)
              : null;
            const isDownstream = !!linkedT && !isAnchor;

            // Marker: diamond for anchors, filled circle with white core otherwise.
            if (isAnchor) {
              const r = Math.max(markerR + 3, 6);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y - r);
              ctx.lineTo(p.x + r, p.y);
              ctx.lineTo(p.x, p.y + r);
              ctx.lineTo(p.x - r, p.y);
              ctx.closePath();
              ctx.fillStyle = "#ffffff";
              ctx.fill();
              ctx.strokeStyle = color;
              ctx.lineWidth = 2;
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(p.x, p.y, markerR, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
            }

            // Label — anchors show only the raw reading, downstream points show `raw+delta`.
            const label = isDownstream
              ? `${p.value.toFixed(2)}${formatDelta(transitionDelta(linkedT!))}`
              : p.value.toFixed(2);
            const markerHalo = isAnchor ? Math.max(markerR + 3, 6) : markerR;
            const lx = p.x + markerHalo + 4;
            const ly = p.y + markerHalo + 3;
            ctx.font = "bold 12px sans-serif";
            const tm = ctx.measureText(label);
            const padX = 3;
            const padY = 2;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.roundRect(lx - padX, ly - padY, tm.width + padX * 2, 12 + padY * 2, 4);
            ctx.fill();

            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = "#111827";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, lx + tm.width / 2, ly - padY + (12 + padY * 2) / 2);
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
            left: editorScreen.left,
            top: editorScreen.top,
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
            <Button variant="ghost" size="sm" onClick={() => setEditingNoteId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveNoteEditor}>
              Save
            </Button>
          </div>
        </div>
      )}

      <NumericKeypad
        open={((!!pending && !bpPromptOpen) || !!editingPoint) && !addingTransition}
        initialValue={editingPoint ? editingPoint.value : isBasePointCapture ? 9.0 : undefined}
        repeatValue={
          !editingPoint && !isBasePointCapture ? points[points.length - 1]?.value : undefined
        }
        title={keypadTitle}
        subtitle="Inches. Positive = higher, negative = lower."
        onClose={() => {
          setPending(null);
          setEditingPoint(null);
        }}
        onSubmit={submitValue}
        onDelete={
          editingPoint
            ? async () => {
                const p = editingPoint;
                setEditingPoint(null);
                await deletePoint(p.id);
                const reindexed = await reindexFloorPoints(floor.id);
                onPointsChange(reindexed);
                commitSnap(reindexed);
              }
            : undefined
        }
        activeTransition={
          activeTransitionId && !editingPoint
            ? (() => {
                const t = transitions.find((x) => x.id === activeTransitionId);
                if (!t) return undefined;
                return {
                  label: `→ ${t.surfaceB}`,
                  delta: transitionDelta(t),
                };
              })()
            : undefined
        }
        onRemoveTransition={
          activeTransitionId && !editingPoint ? () => setActiveTransitionId(null) : undefined
        }
        onAddTransition={
          !editingPoint && pending && !isBasePointCapture
            ? () => setAddingTransition(true)
            : undefined
        }
      />

      {/* Add-Transition sheet — captures both readings at a doorway. */}
      <AddTransitionSheet
        open={addingTransition && !!pending}
        onClose={() => setAddingTransition(false)}
        onSave={handleAddTransition}
      />


      {/* Anchor diamond → detail dialog. */}
      {viewingTransitionId && (
        <TransitionDetailDialog
          transition={transitions.find((t) => t.id === viewingTransitionId)!}
          open={!!viewingTransitionId}
          downstreamCount={points.filter((p) => p.transitionId === viewingTransitionId && !p.isTransitionAnchor).length}
          onClose={() => setViewingTransitionId(null)}
          onSave={handleSaveTransition}
          onDelete={() => handleDeleteTransition(viewingTransitionId)}
        />
      )}



      {bpPromptOpen && pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-background rounded-xl shadow-2xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold mb-1">Set Base Point</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This is your first point. It becomes <span className="font-mono">BP1</span>, the
              reference elevation. Default is 9.0". Tap Continue to enter its value.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPending(null);
                  setBpPromptOpen(false);
                }}
              >
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
