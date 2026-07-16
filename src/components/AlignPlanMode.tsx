import { useMemo, useRef, useState } from "react";
import { X, Check, Upload, RotateCcw, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PlanCanvas } from "@/components/PlanCanvas";
import { saveFloor } from "@/lib/db";
import type { Floor, PlanTransform, SurveyPoint } from "@/lib/types";
import { toast } from "sonner";

/**
 * Align mode — swap the plan image on a duplicated project and re-fit it
 * (translate / scale / rotate) so its walls line up with existing points.
 * Points are never moved by this component. All changes are session-local
 * until "Done" saves them.
 */
interface Props {
  floor: Floor;
  points: SurveyPoint[];
  onDone: (nextFloor: Floor) => void;
  onCancel: () => void;
  pointColor: string;
  pointSize: number;
}

const IDENTITY: PlanTransform = { tx: 0, ty: 0, scale: 1, rotation: 0 };

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
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    x: number;
    y: number;
    startTx: number;
    startTy: number;
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
    // New image starts on identity so the user can align from a clean slate.
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
    onDone(next);
    toast.success("Plan image aligned");
  }

  // Points overlay — locked; drawn as filled dots identical to Field styling.
  const drawPointsOverlay = useMemo(
    () => (ctx: CanvasRenderingContext2D) => {
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, pointSize, 0, Math.PI * 2);
        ctx.fillStyle = pointColor;
        ctx.fill();
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    },
    [points, pointColor, pointSize],
  );

  // 1-finger drag on the canvas pans the image (not the view). Returns true
  // from onImagePointerDown to consume the gesture from PlanCanvas.
  function onImageDown(x: number, y: number): boolean {
    dragStart.current = {
      x,
      y,
      startTx: transform.tx,
      startTy: transform.ty,
    };
    setDragging(true);
    return true;
  }
  function onImageMove(x: number, y: number) {
    const s = dragStart.current;
    if (!s) return;
    setTransform((t) => ({
      ...t,
      tx: s.startTx + (x - s.x),
      ty: s.startTy + (y - s.y),
    }));
  }
  function onImageUp() {
    dragStart.current = null;
    setDragging(false);
  }
  function onImageCancel() {
    dragStart.current = null;
    setDragging(false);
  }

  const rotationDeg = (transform.rotation * 180) / Math.PI;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background/95">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Align plan image</div>
          <div className="text-[11px] text-muted-foreground truncate">
            Points are locked. Move, scale, and rotate the plan until walls line up.
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

      {/* Canvas */}
      <div className="relative flex-1 min-h-0">
        <PlanCanvas
          planDataUrl={planDataUrl}
          planWidth={imgW}
          planHeight={imgH}
          planTransform={transform}
          refitOnResize={false}
          drawOverlayTop={drawPointsOverlay}
          onImagePointerDown={onImageDown}
          onImagePointerMove={onImageMove}
          onImagePointerUp={onImageUp}
          onImagePointerCancel={onImageCancel}
        />
        {dragging && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 text-white text-[11px] px-2 py-0.5">
            Moving image…
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
          <span>{points.length} points locked</span>
        </div>
      </div>
    </div>
  );
}
