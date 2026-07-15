import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Upload, Undo2, ArrowRight, ArrowLeft, Ban, Check, X } from "lucide-react";
import { PlanCanvas } from "../PlanCanvas";
import { saveFloor, saveProject, deleteFloor, uid, listFloors } from "@/lib/db";
import { drawExclusionShape } from "@/lib/exclusions";
import type { Floor, Exclusion, ProjectMeta } from "@/lib/types";

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
  const hasPlan = !!activeFloor?.planDataUrl;

  const steps: Array<{ key: "details" | "plan" | "boundary"; label: string }> = [
    { key: "details", label: "1. Details" },
    { key: "plan", label: "2. Plan" },
    { key: "boundary", label: "3. Boundary" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === tab);
  const prevStep = stepIndex > 0 ? steps[stepIndex - 1] : null;
  const nextStep = stepIndex < steps.length - 1 ? steps[stepIndex + 1] : null;

  // Next / Start conditions
  const nextDisabled = tab === "plan" && !hasPlan;
  const startDisabled = !hasPlan;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b flex overflow-x-auto">
        {steps.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px " +
              (tab === key
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

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-3 py-2 flex items-center gap-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {prevStep ? (
          <Button variant="ghost" size="sm" onClick={() => setTab(prevStep.key)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}
        <div className="ml-auto flex items-center gap-3">
          {tab === "plan" && !hasPlan && (
            <span className="text-xs text-muted-foreground">Upload a plan first</span>
          )}
          {tab === "boundary" && !hasPlan && (
            <span className="text-xs text-muted-foreground">Upload a plan first</span>
          )}
          {nextStep ? (
            <Button
              onClick={() => setTab(nextStep.key)}
              disabled={nextDisabled}
              variant={tab === "details" ? "default" : "default"}
            >
              Next: {nextStep.key === "plan" ? "Plan" : "Boundary"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            onStartSurveying && (
              <Button onClick={onStartSurveying} disabled={startDisabled}>
                Start surveying
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )
          )}
        </div>
      </div>
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
  const exclusions = floor.exclusions ?? [];
  const boundaryClosed = boundary.length >= 3;

  // Which polygon are we drawing / editing?
  // "boundary": outer boundary. "exclusion:new": drafting a new exclusion.
  // "exclusion:<id>": editing an existing one (vertex drag).
  const [tool, setTool] = useState<"boundary" | "exclusion">("boundary");
  const [draft, setDraft] = useState<{ x: number; y: number }[] | null>(null);

  // Drag state — works for boundary and any exclusion polygon.
  const dragRef = useRef<{
    target: "boundary" | { exclusionId: string };
    index: number;
    original: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [, force] = useState(0);

  const HIT_RADIUS = 18;

  function findVertexAt(x: number, y: number):
    | { target: "boundary"; index: number }
    | { target: { exclusionId: string }; index: number }
    | null {
    let best: { target: "boundary" | { exclusionId: string }; index: number } | null = null;
    let bestD2 = HIT_RADIUS * HIT_RADIUS;
    if (tool === "boundary" || tool === "exclusion") {
      for (let i = 0; i < boundary.length; i++) {
        const dx = boundary[i].x - x;
        const dy = boundary[i].y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2 && tool === "boundary") {
          bestD2 = d2;
          best = { target: "boundary", index: i };
        }
      }
    }
    if (tool === "exclusion") {
      for (const ex of exclusions) {
        for (let i = 0; i < ex.polygon.length; i++) {
          const dx = ex.polygon[i].x - x;
          const dy = ex.polygon[i].y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= bestD2) {
            bestD2 = d2;
            best = { target: { exclusionId: ex.id }, index: i };
          }
        }
      }
    }
    return best as ReturnType<typeof findVertexAt>;
  }

  function saveDraft() {
    if (!draft || draft.length < 3) return;
    const ex: Exclusion = {
      id: uid(),
      polygon: draft,
      label: `Excluded ${exclusions.length + 1}`,
      createdAt: Date.now(),
    };
    onChange({ ...floor, exclusions: [...exclusions, ex] });
    setDraft(null);
  }

  function updateExclusion(id: string, patch: Partial<Exclusion>) {
    onChange({
      ...floor,
      exclusions: exclusions.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  function deleteExclusion(id: string) {
    if (!confirm("Delete this excluded area?")) return;
    onChange({ ...floor, exclusions: exclusions.filter((e) => e.id !== id) });
  }

  const drafting = tool === "exclusion" && !!draft;

  return (
    <div className="flex flex-col h-full">
      {/* Tool switcher */}
      <div className="border-b bg-background/70 px-2 py-1.5 flex items-center gap-1">
        <Button
          size="sm"
          variant={tool === "boundary" ? "default" : "ghost"}
          onClick={() => {
            setTool("boundary");
            setDraft(null);
          }}
          className="h-7"
        >
          Outer boundary
        </Button>
        <Button
          size="sm"
          variant={tool === "exclusion" ? "default" : "ghost"}
          onClick={() => setTool("exclusion")}
          disabled={!boundaryClosed}
          className="h-7"
          title={boundaryClosed ? undefined : "Draw the outer boundary first"}
        >
          <Ban className="h-3.5 w-3.5 mr-1" />
          Excluded areas
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {tool === "boundary" && (
            <>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Tap to add · drag a vertex to move
              </span>
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
            </>
          )}
          {tool === "exclusion" && !drafting && (
            <Button size="sm" variant="outline" onClick={() => setDraft([])}>
              <Plus className="h-4 w-4 mr-1" /> New excluded area
            </Button>
          )}
          {tool === "exclusion" && drafting && (
            <>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Tap to add corners · at least 3
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraft((d) => (d ? d.slice(0, -1) : d))}
                disabled={!draft || draft.length === 0}
              >
                <Undo2 className="h-4 w-4 mr-1" /> Undo
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={saveDraft}
                disabled={!draft || draft.length < 3}
              >
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Exclusion list (only when in exclusion mode with some existing) */}
      {tool === "exclusion" && exclusions.length > 0 && (
        <div className="border-b px-2 py-1.5 flex flex-wrap gap-1.5 bg-muted/30">
          {exclusions.map((ex) => (
            <div
              key={ex.id}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
            >
              <input
                value={ex.label ?? ""}
                onChange={(e) => updateExclusion(ex.id, { label: e.target.value })}
                className="w-24 bg-transparent outline-none border-b border-transparent focus:border-primary"
                placeholder="Label"
              />
              <button
                type="button"
                onClick={() => deleteExclusion(ex.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete excluded area"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PlanCanvas
        planDataUrl={floor.planDataUrl}
        planWidth={floor.planWidth}
        planHeight={floor.planHeight}
        onTap={(x, y) => {
          if (tool === "boundary") {
            const hit = findVertexAt(x, y);
            if (hit) return; // handled as drag
            onChange({ ...floor, boundary: [...boundary, { x, y }] });
          } else if (drafting && draft) {
            setDraft([...draft, { x, y }]);
          }
        }}
        onImagePointerDown={(x, y) => {
          const hit = findVertexAt(x, y);
          if (!hit) return false;
          if (hit.target === "boundary") {
            dragRef.current = {
              target: "boundary",
              index: hit.index,
              original: { x: boundary[hit.index].x, y: boundary[hit.index].y },
              moved: false,
            };
          } else {
            const eid = hit.target.exclusionId;
            const ex = exclusions.find((e) => e.id === eid)!;
            dragRef.current = {
              target: { exclusionId: eid },
              index: hit.index,
              original: { x: ex.polygon[hit.index].x, y: ex.polygon[hit.index].y },
              moved: false,
            };
          }
          force((n) => n + 1);
          return true;
        }}
        onImagePointerMove={(x, y) => {
          const drag = dragRef.current;
          if (!drag) return;
          drag.moved = true;
          if (drag.target === "boundary") {
            const next = boundary.slice();
            next[drag.index] = { x, y };
            onChange({ ...floor, boundary: next });
          } else {
            const eid = drag.target.exclusionId;
            onChange({
              ...floor,
              exclusions: exclusions.map((e) => {
                if (e.id !== eid) return e;
                const poly = e.polygon.slice();
                poly[drag.index] = { x, y };
                return { ...e, polygon: poly };
              }),
            });
          }
        }}
        onImagePointerUp={() => {
          dragRef.current = null;
          force((n) => n + 1);
        }}
        onImagePointerCancel={() => {
          const drag = dragRef.current;
          if (drag && drag.moved) {
            if (drag.target === "boundary") {
              const next = boundary.slice();
              next[drag.index] = drag.original;
              onChange({ ...floor, boundary: next });
            } else {
              const eid = drag.target.exclusionId;
              onChange({
                ...floor,
                exclusions: exclusions.map((e) => {
                  if (e.id !== eid) return e;
                  const poly = e.polygon.slice();
                  poly[drag.index] = drag.original;
                  return { ...e, polygon: poly };
                }),
              });
            }
          }
          dragRef.current = null;
          force((n) => n + 1);
        }}
        drawOverlay={(ctx) => {
          // Boundary
          if (boundary.length > 0) {
            ctx.beginPath();
            boundary.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            if (boundary.length > 2) ctx.closePath();
            ctx.fillStyle = "rgba(59,130,246,0.15)";
            if (boundary.length > 2) ctx.fill();
            ctx.strokeStyle = "#2563eb";
            ctx.lineWidth = 3;
            ctx.stroke();
            const dragging =
              dragRef.current && dragRef.current.target === "boundary"
                ? dragRef.current.index
                : -1;
            boundary.forEach((p, i) => {
              const active = i === dragging;
              ctx.beginPath();
              ctx.arc(p.x, p.y, active ? 9 : 6, 0, Math.PI * 2);
              ctx.fillStyle = active ? "#f59e0b" : "#2563eb";
              ctx.fill();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.stroke();
            });
          }

          // Saved exclusions
          for (const ex of exclusions) {
            drawExclusionShape(ctx, ex.polygon, {
              closed: true,
              muted: tool !== "exclusion",
              hatched: true,
            });
            if (tool === "exclusion") {
              const dragging =
                dragRef.current &&
                typeof dragRef.current.target === "object" &&
                dragRef.current.target.exclusionId === ex.id
                  ? dragRef.current.index
                  : -1;
              ex.polygon.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, i === dragging ? 8 : 5, 0, Math.PI * 2);
                ctx.fillStyle = i === dragging ? "#f59e0b" : "#4b5563";
                ctx.fill();
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1.5;
                ctx.stroke();
              });
              if (ex.polygon.length > 0 && ex.label) {
                const cx = ex.polygon.reduce((s, p) => s + p.x, 0) / ex.polygon.length;
                const cy = ex.polygon.reduce((s, p) => s + p.y, 0) / ex.polygon.length;
                ctx.font = "bold 12px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const tw = ctx.measureText(ex.label).width;
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.fillRect(cx - tw / 2 - 4, cy - 9, tw + 8, 18);
                ctx.fillStyle = "#374151";
                ctx.fillText(ex.label, cx, cy);
              }
            }
          }

          // Draft exclusion
          if (drafting && draft) {
            drawExclusionShape(ctx, draft, { closed: draft.length >= 3, muted: false, hatched: true });
            draft.forEach((p, i) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = "#4b5563";
              ctx.fill();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = "#111827";
              ctx.font = "bold 10px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(i + 1), p.x, p.y - 12);
            });
          }
        }}
      />
    </div>
  );
}
