import { useMemo, useRef, useState } from "react";
import { X, Check, Upload, RotateCcw, Move, Image as ImageIcon, MousePointer2, MousePointerClick, ArrowLeftRight, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PlanCanvas } from "@/components/PlanCanvas";
import { saveFloor, savePoint } from "@/lib/db";
import type { Floor, PlanTransform, SurveyPoint } from "@/lib/types";
import { toast } from "sonner";

/**
 * Cleanup screen — the "sit down at a desk" surface for manipulating (not
 * entering, not presenting) the survey data. Two sub-modes:
 *   - "image": drag/scale/rotate the raster + replace plan image; points locked.
 *   - "points": drag individual points, or multi-select and drag as a group.
 * Also surfaces quick access to Transitions and Review, which are the other
 * data-manipulation tools. All changes are session-local until "Done" saves.
 */
interface Props {
  floor: Floor;
  points: SurveyPoint[];
  onDone: (nextFloor: Floor, updatedPoints: SurveyPoint[]) => void;
  onCancel: () => void;
  pointColor: string;
  pointSize: number;
  /** Optional shortcuts surfaced in the Cleanup header. */
  onOpenTransitions?: () => void;
  onOpenReview?: () => void;
  /** Title shown in the header. Defaults to "Cleanup". */
  title?: string;
}


const IDENTITY: PlanTransform = { tx: 0, ty: 0, scale: 1, rotation: 0 };
type SubMode = "image" | "points";

export function AlignPlanMode({
  floor,
  points,
  onDone,
  onCancel,
  pointColor,
  pointSize,
}: Props) {
  // Working state (session only).
  const [planDataUrl, setPlanDataUrl] = useState<string | undefined>(floor.planDataUrl);
  const [planWidth, setPlanWidth] = useState<number | undefined>(floor.planWidth);
  const [planHeight, setPlanHeight] = useState<number | undefined>(floor.planHeight);
  const [transform, setTransform] = useState<PlanTransform>(
    floor.planTransform ?? IDENTITY,
  );
  const [workPoints, setWorkPoints] = useState<SurveyPoint[]>(points);
  const [subMode, setSubMode] = useState<SubMode>("image");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<null | "image" | "point">(null);

  const imageDragStart = useRef<{
    x: number;
    y: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const pointDragStart = useRef<{
    x: number;
    y: number;
    ids: string[];
    origin: Map<string, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const imgW = planWidth ?? 1000;
  const imgH = planHeight ?? 750;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = dataUrl;
    });
    setPlanDataUrl(dataUrl);
    setPlanWidth(dims.w);
    setPlanHeight(dims.h);
    setTransform(IDENTITY);
  }

  async function handleDone() {
    const next: Floor = {
      ...floor,
      planDataUrl,
      planWidth,
      planHeight,
      planTransform: transform,
    };
    await saveFloor(next);
    // Persist any moved points.
    const origById = new Map(points.map((p) => [p.id, p]));
    const changed = workPoints.filter((p) => {
      const o = origById.get(p.id);
      return !o || o.x !== p.x || o.y !== p.y;
    });
    for (const p of changed) await savePoint(p);
    onDone(next, workPoints);
    toast.success(
      changed.length > 0
        ? `Plan aligned; ${changed.length} point${changed.length === 1 ? "" : "s"} moved`
        : "Plan image aligned",
    );
  }

  // Points overlay — filled dots identical to Field styling, with a ring on
  // selected points when in points sub-mode.
  const drawPointsOverlay = useMemo(
    () => (ctx: CanvasRenderingContext2D) => {
      for (const p of workPoints) {
        const isSelected = selectedIds.has(p.id);
        ctx.beginPath();
        ctx.arc(p.x, p.y, pointSize, 0, Math.PI * 2);
        ctx.fillStyle = pointColor;
        ctx.fill();
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, pointSize + 5, 0, Math.PI * 2);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#f59e0b";
          ctx.stroke();
        }
      }
    },
    [workPoints, pointColor, pointSize, selectedIds],
  );

  function hitPoint(x: number, y: number): SurveyPoint | null {
    const r = Math.max(pointSize + 8, 14);
    let best: SurveyPoint | null = null;
    let bestD = Infinity;
    for (const p of workPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // Pointer plumbing — routes based on subMode.
  function onImageDown(x: number, y: number): boolean {
    if (subMode === "points") {
      const hit = hitPoint(x, y);
      if (!hit) return false;
      // Which set moves? If tapping a selected point, move the whole selection.
      // If tapping a non-selected point, drag just that one (selection unchanged
      // until pointerup with no movement, in select mode).
      const movingIds =
        selectMode && selectedIds.has(hit.id)
          ? Array.from(selectedIds)
          : selectMode
            ? [hit.id]
            : [hit.id];
      const origin = new Map<string, { x: number; y: number }>();
      for (const id of movingIds) {
        const p = workPoints.find((q) => q.id === id);
        if (p) origin.set(id, { x: p.x, y: p.y });
      }
      pointDragStart.current = { x, y, ids: movingIds, origin, moved: false };
      setDragging("point");
      // Stash the tapped id so pointerup can toggle selection on a pure tap.
      (pointDragStart.current as unknown as { tapId: string }).tapId = hit.id;
      return true;
    }
    // Image sub-mode: pan the raster.
    imageDragStart.current = {
      x,
      y,
      startTx: transform.tx,
      startTy: transform.ty,
    };
    setDragging("image");
    return true;
  }

  function onImageMove(x: number, y: number) {
    if (dragging === "point" && pointDragStart.current) {
      const s = pointDragStart.current;
      const dx = x - s.x;
      const dy = y - s.y;
      if (!s.moved && Math.hypot(dx, dy) > 3) s.moved = true;
      if (!s.moved) return;
      setWorkPoints((prev) =>
        prev.map((p) => {
          const o = s.origin.get(p.id);
          if (!o) return p;
          return { ...p, x: o.x + dx, y: o.y + dy };
        }),
      );
      return;
    }
    if (dragging === "image" && imageDragStart.current) {
      const s = imageDragStart.current;
      setTransform((t) => ({
        ...t,
        tx: s.startTx + (x - s.x),
        ty: s.startTy + (y - s.y),
      }));
    }
  }

  function onImageUp() {
    if (dragging === "point" && pointDragStart.current) {
      const s = pointDragStart.current;
      const tapId = (s as unknown as { tapId?: string }).tapId;
      // Pure tap (no drag) in select mode → toggle selection.
      if (!s.moved && selectMode && tapId) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(tapId)) next.delete(tapId);
          else next.add(tapId);
          return next;
        });
      }
    }
    imageDragStart.current = null;
    pointDragStart.current = null;
    setDragging(null);
  }

  function onImageCancel() {
    imageDragStart.current = null;
    pointDragStart.current = null;
    setDragging(null);
  }

  const rotationDeg = (transform.rotation * 180) / Math.PI;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background/95">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Align plan image</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {subMode === "image"
              ? "Points are locked. Move, scale, and rotate the plan until walls line up."
              : selectMode
                ? "Tap points to add/remove from selection. Drag a selected point to move the group."
                : "Drag any point to nudge it. Turn on Select to move a group."}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
          <Button size="sm" onClick={handleDone}>
            <Check className="mr-1 h-4 w-4" /> Done
          </Button>
        </div>
      </header>

      {/* Sub-mode toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-background/95">
        <div className="inline-flex rounded-full border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => {
              setSubMode("image");
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            className={
              "px-3 py-1.5 flex items-center gap-1.5 " +
              (subMode === "image"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-foreground hover:bg-muted")
            }
          >
            <ImageIcon className="h-3.5 w-3.5" /> Move image
          </button>
          <button
            type="button"
            onClick={() => setSubMode("points")}
            className={
              "px-3 py-1.5 flex items-center gap-1.5 border-l " +
              (subMode === "points"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-foreground hover:bg-muted")
            }
          >
            <MousePointer2 className="h-3.5 w-3.5" /> Move points
          </button>
        </div>
        {subMode === "points" && (
          <button
            type="button"
            onClick={() => {
              setSelectMode((v) => {
                const next = !v;
                if (!next) setSelectedIds(new Set());
                return next;
              });
            }}
            className={
              "ml-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs " +
              (selectMode
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-transparent text-foreground hover:bg-muted")
            }
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            {selectMode
              ? selectedIds.size > 0
                ? `Select · ${selectedIds.size}`
                : "Select · on"
              : "Select"}
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-0">
        <PlanCanvas
          planDataUrl={planDataUrl}
          planWidth={imgW}
          planHeight={imgH}
          planTransform={transform}
          refitOnResize={true}
          drawOverlayTop={drawPointsOverlay}
          onImagePointerDown={onImageDown}
          onImagePointerMove={onImageMove}
          onImagePointerUp={onImageUp}
          onImagePointerCancel={onImageCancel}
        />
        {dragging === "image" && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 text-white text-[11px] px-2 py-0.5">
            Moving image…
          </div>
        )}
        {dragging === "point" && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 text-white text-[11px] px-2 py-0.5">
            Moving {pointDragStart.current?.ids.length ?? 1} point
            {(pointDragStart.current?.ids.length ?? 1) === 1 ? "" : "s"}…
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="border-t bg-background/95 p-3 space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        {subMode === "image" ? (
          <>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" /> Replace image…
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTransform(IDENTITY)}
                title="Reset transform"
              >
                <RotateCcw className="mr-1 h-4 w-4" /> Reset
              </Button>
              <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <Move className="h-3.5 w-3.5" /> drag on canvas
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Scale</span>
                <span>{transform.scale.toFixed(3)}×</span>
              </div>
              <Slider
                min={0.2}
                max={3}
                step={0.005}
                value={[transform.scale]}
                onValueChange={([v]) => setTransform((t) => ({ ...t, scale: v }))}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Rotation</span>
                <span>{rotationDeg.toFixed(1)}°</span>
              </div>
              <Slider
                min={-30}
                max={30}
                step={0.1}
                value={[rotationDeg]}
                onValueChange={([deg]) =>
                  setTransform((t) => ({ ...t, rotation: (deg * Math.PI) / 180 }))
                }
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Offset: {transform.tx.toFixed(0)}, {transform.ty.toFixed(0)} px
              </span>
              <span>{workPoints.length} points locked</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {selectMode
                ? `${selectedIds.size} selected of ${workPoints.length}`
                : `${workPoints.length} points · drag to move`}
            </span>
            {selectMode && selectedIds.size > 0 && (
              <button
                type="button"
                className="underline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
