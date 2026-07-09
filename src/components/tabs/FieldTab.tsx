import { useEffect, useRef, useState } from "react";
import { PlanCanvas } from "../PlanCanvas";
import { NumericKeypad } from "../NumericKeypad";
import { DataPointsPanel } from "../DataPointsPanel";
import { Button } from "@/components/ui/button";
import { Trash2, Undo2, X } from "lucide-react";
import type { Floor, SurveyPoint, Transition } from "@/lib/types";
import {
  savePoint,
  deletePoint,
  saveTransition,
  deleteTransition,
  listTransitions,
  uid,
} from "@/lib/db";

interface Props {
  projectId: string;
  floor: Floor;
  points: SurveyPoint[];
  onPointsChange: (points: SurveyPoint[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}

/** Pending capture state: what the next keypad submit will do. */
type PendingKind =
  | { kind: "normal"; x: number; y: number }
  | { kind: "anchor-first"; x: number; y: number } // capturing the transition anchor
  | { kind: "adjacent"; x: number; y: number; anchor: SurveyPoint }; // capturing the adjacent surface reading

type DragState = {
  id: string;
  moved: boolean;
  startClientX: number;
  startClientY: number;
  lastX: number;
  lastY: number;
};

export function FieldTab({ projectId, floor, points, onPointsChange, selectedIds, setSelectedIds }: Props) {
  const scaleRef = useRef(1);
  const [pending, setPending] = useState<PendingKind | null>(null);
  const [bpPromptOpen, setBpPromptOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<SurveyPoint | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const trashRef = useRef<HTMLButtonElement | null>(null);

  // Transitions on this floor + which one is currently applied to new points.
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [activeTransitionId, setActiveTransitionId] = useState<string | null>(null);
  const [transitionMenuOpen, setTransitionMenuOpen] = useState(false);
  // When user tapped "Add transition" but hasn't placed the anchor yet.
  const [awaitingAnchor, setAwaitingAnchor] = useState(false);
  // After anchor placed, we wait for the adjacent-surface tap.
  const [awaitingAdjacent, setAwaitingAdjacent] = useState<SurveyPoint | null>(null);

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

  // Load transitions when floor changes.
  useEffect(() => {
    (async () => {
      const list = await listTransitions(floor.id);
      setTransitions(list);
      // Auto-load the most recent one if none active.
      setActiveTransitionId((cur) => cur ?? (list[list.length - 1]?.id ?? null));
    })();
    setAwaitingAnchor(false);
    setAwaitingAdjacent(null);
  }, [floor.id]);

  useEffect(() => {
    if (!dragging) {
      setTrashHover(false);
      return;
    }
    function onMove(e: PointerEvent) {
      if (!dragRef.current?.moved) return;
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
  const activeTransition = transitions.find((t) => t.id === activeTransitionId) ?? null;

  async function handleTap(x: number, y: number) {
    // If tapped near existing point, ignore (edits happen on drag/tap in existing handlers).
    for (const p of points) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 12) return;
    }
    if (awaitingAnchor) {
      setPending({ kind: "anchor-first", x, y });
      return;
    }
    if (awaitingAdjacent) {
      setPending({ kind: "adjacent", x, y, anchor: awaitingAdjacent });
      return;
    }
    setPending({ kind: "normal", x, y });
    if (isBasePointCapture) setBpPromptOpen(true);
  }

  /** Compute effective value = raw + offset. */
  function applyOffset(raw: number, offset: number | undefined): number {
    return raw + (offset ?? 0);
  }

  async function submitValue(v: number) {
    // Edit existing point → v is the new raw; recompute value using stored offset.
    if (editingPoint) {
      const offset = editingPoint.offset ?? 0;
      const updated: SurveyPoint = {
        ...editingPoint,
        raw: v,
        value: applyOffset(v, offset),
      };
      await savePoint(updated);
      onPointsChange(points.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPoint(null);
      return;
    }
    if (!pending) return;

    // Adjacent-surface reading → creates the Transition record and this point (normalized).
    if (pending.kind === "adjacent") {
      const anchor = pending.anchor;
      const offset = anchor.value - v; // add to raw carpet readings to reach tile reference
      const now = Date.now();
      const tId = uid();
      const transition: Transition = {
        id: tId,
        floorId: floor.id,
        anchorId: anchor.id,
        offset,
        createdAt: now,
      };
      // Tag the anchor with its own transition id.
      const updatedAnchor: SurveyPoint = { ...anchor, transitionId: tId };
      const adjacent: SurveyPoint = {
        id: uid(),
        floorId: floor.id,
        index: nextIndex,
        x: pending.x,
        y: pending.y,
        raw: v,
        offset,
        value: applyOffset(v, offset),
        transitionId: tId,
        createdAt: now,
      };
      await saveTransition(transition);
      await savePoint(updatedAnchor);
      await savePoint(adjacent);
      setTransitions((prev) => [...prev, transition]);
      setActiveTransitionId(tId);
      onPointsChange(
        points.map((p) => (p.id === anchor.id ? updatedAnchor : p)).concat(adjacent),
      );
      setAwaitingAdjacent(null);
      setPending(null);
      return;
    }

    // Anchor placement → save as a plain point with isTransitionAnchor=true, then prompt for adjacent.
    if (pending.kind === "anchor-first") {
      const now = Date.now();
      const anchor: SurveyPoint = {
        id: uid(),
        floorId: floor.id,
        index: nextIndex,
        x: pending.x,
        y: pending.y,
        raw: v,
        offset: 0,
        value: v,
        isTransitionAnchor: true,
        createdAt: now,
      };
      await savePoint(anchor);
      onPointsChange([...points, anchor]);
      setAwaitingAnchor(false);
      setAwaitingAdjacent(anchor);
      setPending(null);
      return;
    }

    // Normal capture — apply active transition offset if one is loaded.
    const now = Date.now();
    const idx = nextIndex;
    const isBP = isBasePointCapture;
    const offset = !isBP && activeTransition ? activeTransition.offset : 0;
    const point: SurveyPoint = {
      id: uid(),
      floorId: floor.id,
      index: idx,
      x: pending.x,
      y: pending.y,
      raw: v,
      offset,
      value: applyOffset(v, offset),
      transitionId: !isBP && activeTransition ? activeTransition.id : undefined,
      isBasePoint: isBP,
      label: isBP ? "BP1" : undefined,
      createdAt: now,
    };
    await savePoint(point);
    onPointsChange([...points, point]);
    setPending(null);
    setBpPromptOpen(false);
  }

  /** "Add transition" from a plain-entry keypad: save this pending point as the anchor
   * with the entered value, then prompt for the adjacent-surface reading. */
  async function convertPendingToAnchor(v: number) {
    if (!pending || pending.kind !== "normal") return;
    const now = Date.now();
    const anchor: SurveyPoint = {
      id: uid(),
      floorId: floor.id,
      index: nextIndex,
      x: pending.x,
      y: pending.y,
      raw: v,
      offset: 0,
      value: v,
      isTransitionAnchor: true,
      createdAt: now,
    };
    await savePoint(anchor);
    onPointsChange([...points, anchor]);
    setPending(null);
    setAwaitingAnchor(false);
    setAwaitingAdjacent(anchor);
  }

  function hitPoint(x: number, y: number): { point: SurveyPoint; on: "dot" | "label" } | null {
    // Convert a fixed screen-pixel touch budget (finger-tip size) into image units,
    // so hits stay tight regardless of zoom and don't swallow empty-area taps/pinches.
    const s = scaleRef.current || 1;
    const dotHit = 14 / s; // ~28px screen diameter
    for (const p of points) {
      if (Math.hypot(p.x - x, p.y - y) < dotHit) return { point: p, on: "dot" };
    }
    // Label hit — the value number is a grab handle since the dot is under the finger.
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
    // If undoing an anchor while awaiting adjacent, cancel the flow too.
    if (awaitingAdjacent && awaitingAdjacent.id === last.id) {
      setAwaitingAdjacent(null);
    }
    await deletePoint(last.id);
    onPointsChange(points.slice(0, -1));
  }

  /** Delete a transition and revert every point tagged with it back to raw values. */
  async function removeTransition(tId: string) {
    const affected = points.filter((p) => p.transitionId === tId);
    const updates: SurveyPoint[] = affected.map((p) => ({
      ...p,
      transitionId: undefined,
      offset: 0,
      isTransitionAnchor: false,
      value: p.raw ?? p.value,
    }));
    for (const u of updates) await savePoint(u);
    await deleteTransition(tId);
    const updateMap = new Map(updates.map((u) => [u.id, u]));
    onPointsChange(points.map((p) => updateMap.get(p.id) ?? p));
    setTransitions((prev) => prev.filter((t) => t.id !== tId));
    if (activeTransitionId === tId) setActiveTransitionId(null);
  }

  // Keypad configuration based on pending kind
  const keypadTitle = editingPoint
    ? `Edit point #${editingPoint.index}`
    : pending?.kind === "anchor-first"
      ? "Transition anchor value"
      : pending?.kind === "adjacent"
        ? "Adjacent surface reading"
        : isBasePointCapture
          ? "Base Point value (BP1)"
          : `Point #${nextIndex}`;

  const keypadSubtitle = pending?.kind === "anchor-first"
    ? "Reading on the reference surface (e.g. tile)."
    : pending?.kind === "adjacent"
      ? `Raw reading on the other surface. Offset = ${pending.anchor.value.toFixed(2)} − this.`
      : activeTransition && !editingPoint && !isBasePointCapture
        ? `Applying transition ${activeTransition.offset >= 0 ? "+" : ""}${activeTransition.offset.toFixed(2)}"`
        : "Inches. Positive = higher, negative = lower.";

  const secondaryAction = (() => {
    // Only offer "Add transition" during a plain normal entry (not editing, not BP1, not already in a flow).
    if (editingPoint) return undefined;
    if (!pending || pending.kind !== "normal") return undefined;
    if (isBasePointCapture) return undefined;
    return {
      label: "Add transition (use as anchor)",
      onClick: (v: number) => convertPendingToAnchor(v),
    };
  })();

  return (
    <div className="flex flex-col h-full relative">
      {/* Floating status chip (top-left) */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border shadow-sm px-2.5 py-1 text-xs">
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

      {/* Floating Undo (top-right) */}
      <button
        onClick={undoLast}
        disabled={points.length === 0}
        aria-label="Undo last point"
        className="absolute top-2 right-2 z-30 h-9 w-9 rounded-full bg-background/90 backdrop-blur border shadow-sm flex items-center justify-center disabled:opacity-40 hover:bg-background"
      >
        <Undo2 className="h-4 w-4" />
      </button>

      {/* Transition chip — only when mid-flow or transitions exist on this floor. */}
      {(awaitingAnchor || awaitingAdjacent || activeTransition || transitions.length > 0) && (
        <div className="absolute top-11 left-2 z-30 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTransitionMenuOpen((v) => !v)}
            className={
              "flex items-center gap-1.5 rounded-full backdrop-blur border shadow-sm px-2.5 py-1 text-xs " +
              (awaitingAnchor || awaitingAdjacent
                ? "bg-amber-100 border-amber-300 text-amber-900"
                : activeTransition
                  ? "bg-blue-50 border-blue-300 text-blue-900"
                  : "bg-background/90")
            }
          >
            <span className="inline-block w-2 h-2 rotate-45 bg-current" />
            {awaitingAnchor ? (
              <span>Tap anchor point…</span>
            ) : awaitingAdjacent ? (
              <span>Tap adjacent surface…</span>
            ) : activeTransition ? (
              <span className="font-mono tabular-nums">
                {activeTransition.offset >= 0 ? "+" : ""}{activeTransition.offset.toFixed(2)}"
              </span>
            ) : (
              <span>Transitions ({transitions.length})</span>
            )}
          </button>
          {(activeTransition || awaitingAnchor || awaitingAdjacent) && (
            <button
              type="button"
              onClick={() => {
                setActiveTransitionId(null);
                setAwaitingAnchor(false);
                setAwaitingAdjacent(null);
              }}
              aria-label="Clear active transition"
              className="rounded-full bg-background/90 backdrop-blur border shadow-sm h-6 w-6 flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}


      {/* Transitions menu */}
      {transitionMenuOpen && (
        <div className="absolute top-20 left-2 z-40 w-64 rounded-lg bg-background border shadow-xl p-2 text-xs">
          <div className="flex items-center justify-between px-1 py-1">
            <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
              Transitions
            </span>
            <button
              onClick={() => setTransitionMenuOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              setAwaitingAnchor(true);
              setAwaitingAdjacent(null);
              setTransitionMenuOpen(false);
            }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
          >
            <span className="inline-block w-2.5 h-2.5 rotate-45 border border-current" />
            <span className="font-medium">Add new transition…</span>
          </button>
          <div className="border-t my-1" />
          {transitions.length === 0 ? (
            <div className="px-2 py-1.5 text-muted-foreground">No transitions yet.</div>
          ) : (
            transitions.map((t) => (
              <div
                key={t.id}
                className={
                  "flex items-center gap-1 px-1 py-1 rounded " +
                  (t.id === activeTransitionId ? "bg-blue-50" : "hover:bg-muted")
                }
              >
                <button
                  onClick={() => {
                    setActiveTransitionId(t.id);
                    setTransitionMenuOpen(false);
                  }}
                  className="flex-1 text-left px-1 py-0.5 flex items-center gap-2"
                >
                  <span className="inline-block w-2.5 h-2.5 rotate-45 bg-blue-500" />
                  <span className="font-mono tabular-nums">
                    {t.offset >= 0 ? "+" : ""}{t.offset.toFixed(2)}"
                  </span>
                  {t.label && <span className="text-muted-foreground truncate">{t.label}</span>}
                  {t.id === activeTransitionId && (
                    <span className="ml-auto text-[9px] uppercase text-blue-700">Active</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete this transition? Points using it will revert to raw values.`)) {
                      removeTransition(t.id);
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label="Delete transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
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
          const hit = hitPoint(x, y);
          if (!hit) return false;
          const { point: hp, on } = hit;
          setSelectedIds(new Set([hp.id]));
          // Tap on an anchor's dot → activate its transition (and don't start a drag).
          if (on === "dot" && hp.isTransitionAnchor && hp.transitionId) {
            setActiveTransitionId(hp.transitionId);
            setAwaitingAnchor(false);
            setAwaitingAdjacent(null);
            return true;
          }
          const drag: DragState = {
            id: hp.id,
            moved: false,
            startClientX: event.clientX,
            startClientY: event.clientY,
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
          // Require deliberate finger movement in screen pixels before treating this as a drag —
          // stops normal taps / keypad touches from triggering the trash overlay.
          if (!drag.moved && screenDist < 18) return;
          const nextDrag = { ...drag, moved: true, lastX: x, lastY: y };
          dragRef.current = nextDrag;
          setDragging(nextDrag);
          const trashEl = trashRef.current;
          if (trashEl) {
            const r = trashEl.getBoundingClientRect();
            setTrashHover(event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom);
          }
          onPointsChange(points.map((p) => (p.id === nextDrag.id ? { ...p, x, y } : p)));
        }}
        onImagePointerCancel={() => {
          // Pinch/zoom took over — abandon any in-progress point drag without deleting.
          dragRef.current = null;
          setDragging(null);
          setTrashHover(false);
        }}
        onImagePointerUp={async (x, y, event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const point = points.find((p) => p.id === drag.id);
          const trashEl = trashRef.current;
          const wasOverTrash = trashEl
            ? (() => {
                const r = trashEl.getBoundingClientRect();
                return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
              })()
            : trashHover;
          const dragId = drag.id;
          dragRef.current = null;
          setDragging(null);
          setTrashHover(false);
          if (!point) return;
          if (wasOverTrash) {
            // Deleting an anchor also nukes its transition + reverts normalized points.
            if (point.isTransitionAnchor && point.transitionId) {
              await removeTransition(point.transitionId);
            }
            await deletePoint(dragId);
            onPointsChange(points.filter((p) => p.id !== dragId));
            return;
          }
          if (!drag.moved) {
            setEditingPoint(point);
            return;
          }
          const updated = { ...point, x: drag.lastX ?? x, y: drag.lastY ?? y };
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
            const isAnchor = !!p.isTransitionAnchor;
            const isNormalized = !!p.transitionId && !isAnchor;
            const color = p.isBasePoint ? "#16a34a" : isAnchor ? "#2563eb" : "#dc2626";

            if (isAnchor) {
              // Diamond marker
              const s = Math.max(pointSize + 4, 7);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y - s);
              ctx.lineTo(p.x + s, p.y);
              ctx.lineTo(p.x, p.y + s);
              ctx.lineTo(p.x - s, p.y);
              ctx.closePath();
              ctx.fillStyle = color;
              ctx.fill();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 1.5;
              ctx.stroke();
            } else {
              // Regular dot
              ctx.beginPath();
              ctx.arc(p.x, p.y, pointSize, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
              if (isNormalized) {
                // Box around the dot
                const box = Math.max(pointSize + 4, 6);
                ctx.strokeStyle = "#2563eb";
                ctx.lineWidth = 1.5;
                ctx.strokeRect(p.x - box, p.y - box, box * 2, box * 2);
              }
            }

            if (sel) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, Math.max(12, pointSize + 8), 0, Math.PI * 2);
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            // value label — always the corrected value
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
            ctx.strokeStyle = pending.kind === "anchor-first" || pending.kind === "adjacent"
              ? "#f59e0b"
              : "#dc2626";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }}
      />

      {dragging?.moved && (
        <button
          ref={trashRef}
          type="button"
          aria-label="Delete point"
          className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-full shadow-lg flex items-center justify-center transition-all ${
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
        initialValue={
          editingPoint
            ? (editingPoint.raw ?? editingPoint.value)
            : isBasePointCapture
              ? 9.0
              : undefined
        }
        repeatValue={
          !editingPoint && pending?.kind === "normal" && !isBasePointCapture
            ? points[points.length - 1]?.raw ?? points[points.length - 1]?.value
            : undefined
        }
        title={keypadTitle}
        subtitle={keypadSubtitle}
        onClose={() => { setPending(null); setEditingPoint(null); }}
        onSubmit={submitValue}
        secondaryAction={secondaryAction}
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
