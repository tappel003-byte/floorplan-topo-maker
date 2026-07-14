import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Upload, Undo2, ArrowRight, ArrowLeft } from "lucide-react";
import { PlanCanvas } from "../PlanCanvas";
import { saveFloor, saveProject, deleteFloor, uid, listFloors } from "@/lib/db";
import type { Floor, ProjectMeta } from "@/lib/types";

interface Props {
  project: ProjectMeta;
  floors: Floor[];
  activeFloor: Floor;
  onProjectChange: (p: ProjectMeta) => void;
  onFloorsChange: (floors: Floor[]) => void;
  onActiveFloorChange: (id: string) => void;
  onStartSurveying?: () => void;

}

export function SetupTab({
  project,
  floors,
  activeFloor,
  onProjectChange,
  onFloorsChange,
  onActiveFloorChange,
  onStartSurveying,
}: Props) {
  const [tab, setTab] = useState<"details" | "plan" | "boundary">("details");
  const canStart = !!activeFloor?.planDataUrl;


  return (
    <div className="flex flex-col h-full">
      <div className="border-b flex overflow-x-auto">
        {(
          [
            ["details", "Details"],
            ["plan", "Plan & floors"],
            ["boundary", "Boundary"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px " +
              (tab === k
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "details" && <DetailsPanel project={project} onChange={onProjectChange} />}
        {tab === "plan" && (
          <PlanPanel
            projectId={project.id}
            floors={floors}
            activeFloor={activeFloor}
            onFloorsChange={onFloorsChange}
            onActiveFloorChange={onActiveFloorChange}
          />
        )}
        {tab === "boundary" && (
          <BoundaryPanel
            floor={activeFloor}
            onChange={async (f) => {
              await saveFloor(f);
              onFloorsChange(await listFloors(project.id));
            }}
          />
        )}
      </div>
      {onStartSurveying && (
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-3 py-2 flex items-center justify-end gap-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          {!canStart && (
            <span className="text-xs text-muted-foreground">Upload a plan first</span>
          )}
          <Button onClick={onStartSurveying} disabled={!canStart}>
            Start surveying
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}


function DetailsPanel({
  project,
  onChange,
}: {
  project: ProjectMeta;
  onChange: (p: ProjectMeta) => void;
}) {
  const [local, setLocal] = useState(project);
  useEffect(() => setLocal(project), [project.id]);

  async function save() {
    await saveProject(local);
    onChange(local);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3">
      <div>
        <Label className="label-micro">Inspection date</Label>
        <Input
          type="date"
          value={local.inspectionDate}
          onChange={(e) => setLocal({ ...local, inspectionDate: e.target.value })}
        />
      </div>
      <div>
        <Label className="label-micro">Project name</Label>
        <Input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} />
      </div>
      <div>
        <Label className="label-micro">Address</Label>
        <Input
          value={local.address}
          onChange={(e) => setLocal({ ...local, address: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="label-micro">Client</Label>
          <Input
            value={local.client}
            onChange={(e) => setLocal({ ...local, client: e.target.value })}
          />
        </div>
        <div>
          <Label className="label-micro">Inspector</Label>
          <Input
            value={local.inspector}
            onChange={(e) => setLocal({ ...local, inspector: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label className="label-micro">Notes</Label>
        <Textarea
          rows={3}
          value={local.notes}
          onChange={(e) => setLocal({ ...local, notes: e.target.value })}
        />
      </div>
      <Button onClick={save}>Save details</Button>
    </div>
  );
}

function PlanPanel({
  projectId,
  floors,
  activeFloor,
  onFloorsChange,
  onActiveFloorChange,
}: {
  projectId: string;
  floors: Floor[];
  activeFloor: Floor;
  onFloorsChange: (f: Floor[]) => void;
  onActiveFloorChange: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    onFloorsChange(await listFloors(projectId));
  }

  async function addFloor() {
    const name = prompt("Floor name", `Floor ${floors.length + 1}`);
    if (!name) return;
    const now = Date.now();
    await saveFloor({
      id: uid(),
      projectId,
      name,
      order: floors.length,
      boundary: [],
      createdAt: now,
      updatedAt: now,
    });
    refresh();
  }

  async function removeFloor(id: string) {
    if (floors.length <= 1) return alert("Keep at least one floor.");
    if (!confirm("Delete this floor and its points?")) return;
    await deleteFloor(id);
    refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    // Get image dimensions
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = dataUrl;
    });
    await saveFloor({
      ...activeFloor,
      planDataUrl: dataUrl,
      planWidth: dims.w,
      planHeight: dims.h,
    });
    e.target.value = "";
    refresh();
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Card className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Floors</div>
          <Button size="sm" variant="outline" onClick={addFloor}>
            <Plus className="h-4 w-4 mr-1" /> Add floor
          </Button>
        </div>
        <div className="space-y-2">
          {floors.map((f) => (
            <div
              key={f.id}
              className={
                "flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer " +
                (f.id === activeFloor.id ? "bg-secondary border-primary" : "bg-background")
              }
              onClick={() => onActiveFloorChange(f.id)}
            >
              <div>
                <div className="text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.planDataUrl ? "Plan uploaded" : "No plan"} · {f.boundary.length} boundary pts
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFloor(f.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3">
        <div className="text-sm font-medium mb-1">Plan image · {activeFloor.name}</div>
        <div className="text-xs text-muted-foreground mb-3">
          Upload a floor plan for this floor. Any image (photo, PDF export, sketch).
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <Button onClick={() => fileRef.current?.click()} variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          {activeFloor.planDataUrl ? "Replace plan" : "Upload plan"}
        </Button>
      </Card>
    </div>
  );
}

function BoundaryPanel({ floor, onChange }: { floor: Floor; onChange: (f: Floor) => void }) {
  const boundary = floor.boundary;
  // Drag state for moving an existing vertex.
  const dragRef = useRef<{
    index: number;
    original: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Hit radius in image pixels. Vertex circles are r=6; give a generous grab zone.
  const HIT_RADIUS = 18;

  function findVertexAt(x: number, y: number): number {
    let best = -1;
    let bestD2 = HIT_RADIUS * HIT_RADIUS;
    for (let i = 0; i < boundary.length; i++) {
      const dx = boundary[i].x - x;
      const dy = boundary[i].y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    return best;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-2 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Tap to add vertices. Drag a vertex to move it.
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...floor, boundary: boundary.slice(0, -1) })}
            disabled={boundary.length === 0}
          >
            <Undo2 className="h-4 w-4 mr-1" /> Undo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...floor, boundary: [] })}
            disabled={boundary.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>
      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        onTap={(x, y) => {
          // Suppress add-vertex if this tap was on an existing vertex (handled as drag).
          if (findVertexAt(x, y) >= 0) return;
          onChange({ ...floor, boundary: [...boundary, { x, y }] });
        }}
        onImagePointerDown={(x, y) => {
          const idx = findVertexAt(x, y);
          if (idx < 0) return false;
          dragRef.current = {
            index: idx,
            original: { x: boundary[idx].x, y: boundary[idx].y },
            moved: false,
          };
          setDragIndex(idx);
          return true; // consume — prevents pan/tap
        }}
        onImagePointerMove={(x, y) => {
          const drag = dragRef.current;
          if (!drag) return;
          drag.moved = true;
          const next = boundary.slice();
          next[drag.index] = { x, y };
          onChange({ ...floor, boundary: next });
        }}
        onImagePointerUp={() => {
          dragRef.current = null;
          setDragIndex(null);
        }}
        onImagePointerCancel={() => {
          // Pinch preempted — revert to original position so nothing gets nudged accidentally.
          const drag = dragRef.current;
          if (drag && drag.moved) {
            const next = boundary.slice();
            next[drag.index] = drag.original;
            onChange({ ...floor, boundary: next });
          }
          dragRef.current = null;
          setDragIndex(null);
        }}
        drawOverlay={(ctx) => {
          if (boundary.length === 0) return;
          ctx.beginPath();
          boundary.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          if (boundary.length > 2) ctx.closePath();
          ctx.fillStyle = "rgba(59,130,246,0.15)";
          ctx.fill();
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 3;
          ctx.stroke();
          boundary.forEach((p, i) => {
            const active = i === dragIndex;
            ctx.beginPath();
            ctx.arc(p.x, p.y, active ? 9 : 6, 0, Math.PI * 2);
            ctx.fillStyle = active ? "#f59e0b" : "#2563eb";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }}
      />
    </div>
  );
}
