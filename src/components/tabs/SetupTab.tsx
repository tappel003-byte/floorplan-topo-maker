import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Undo2, Ban, Check, X } from "lucide-react";
import { PlanCanvas } from "../PlanCanvas";
import { AddressGpsButtons } from "../AddressGpsButtons";
import { SetSquareIcon } from "../SetSquareIcon";
import { saveFloor, saveProject, deleteFloor, uid, listFloors } from "@/lib/db";
import { drawExclusionShape } from "@/lib/exclusions";
import type { Floor, Exclusion, ProjectMeta } from "@/lib/types";
import { CANVAS_FONT_FAMILY } from "@/lib/utils";

const INK = "#1a1a1a";
const PAPER = "#fffaf0";

interface Props {
  project: ProjectMeta;
  floors: Floor[];
  activeFloor: Floor;
  onProjectChange: (p: ProjectMeta) => void;
  onFloorsChange: (floors: Floor[]) => void;
  onActiveFloorChange: (id: string) => void;
  onStartSurveying?: () => void;
  /** True when returning to setup from an existing survey (Save Setup vs Start Survey). */
  isEditing?: boolean;
}

export function SetupTab({
  project,
  floors,
  activeFloor,
  onProjectChange,
  onFloorsChange,
  onActiveFloorChange,
  onStartSurveying,
  isEditing = false,
}: Props) {
  const [step, setStep] = useState<"form" | "boundary">("form");
  const hasPlan = !!activeFloor?.planDataUrl;
  const title = project.name.trim() || "New Survey";
  const primaryLabel = isEditing ? "Save Setup" : "Start Survey";
  const headerLabel = isEditing ? "Save" : "Start";

  async function persistAndStart() {
    // DetailsPanel autosaves; ensure latest project snapshot is flushed via onProjectChange path.
    onStartSurveying?.();
  }

  function onPrimary() {
    if (step === "form") {
      if (!hasPlan) return;
      if (isEditing) {
        void persistAndStart();
        return;
      }
      setStep("boundary");
      return;
    }
    void persistAndStart();
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* DS-style header: ← · title · Start/Save */}
      <header
        className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <Link
          to="/"
          aria-label="Back"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-[22px] text-foreground"
        >
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold" style={{ color: INK }}>
          {title}
        </h1>
        <button
          type="button"
          disabled={step === "form" && !hasPlan}
          onClick={onPrimary}
          className="rounded-[10px] px-3.5 py-2.5 text-sm font-bold disabled:opacity-40"
          style={{ background: INK, color: PAPER }}
        >
          {headerLabel}
        </button>
      </header>

      <div className={step === "boundary" ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-auto"}>
        {step === "form" ? (
          <SetupForm
            project={project}
            floors={floors}
            activeFloor={activeFloor}
            onProjectChange={onProjectChange}
            onFloorsChange={onFloorsChange}
            onActiveFloorChange={onActiveFloorChange}
          />
        ) : (
          <BoundaryPanel
            floor={activeFloor}
            onChange={async (f) => {
              await saveFloor(f);
              onFloorsChange(await listFloors(project.id));
            }}
          />
        )}
      </div>

      {/* DS-style full-width ink footer */}
      <div
        className="shrink-0 border-t border-border bg-card px-[18px] pt-3.5"
        style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}
      >
        {step === "boundary" && (
          <button
            type="button"
            onClick={() => setStep("form")}
            className="mb-2 w-full py-2 text-sm font-medium text-muted-foreground"
          >
            ← Back to details
          </button>
        )}
        <button
          type="button"
          disabled={step === "form" && !hasPlan}
          onClick={onPrimary}
          className="w-full rounded-xl py-[15px] text-base font-bold disabled:opacity-40"
          style={{ background: INK, color: PAPER }}
        >
          {step === "form"
            ? isEditing
              ? "Save Setup"
              : hasPlan
                ? "Start Survey"
                : "Upload a plan to continue"
            : primaryLabel}
        </button>
      </div>
    </div>
  );
}

const fieldClass =
  "h-11 w-full rounded-[10px] border border-input bg-card px-3.5 text-base text-foreground";

function SetupForm({
  project,
  floors,
  activeFloor,
  onProjectChange,
  onFloorsChange,
  onActiveFloorChange,
}: {
  project: ProjectMeta;
  floors: Floor[];
  activeFloor: Floor;
  onProjectChange: (p: ProjectMeta) => void;
  onFloorsChange: (f: Floor[]) => void;
  onActiveFloorChange: (id: string) => void;
}) {
  const [local, setLocal] = useState(project);
  const [saved, setSaved] = useState(false);
  useEffect(() => setLocal(project), [project.id]);

  // Keep survey date readable — never blank on open; never invent after user clears.
  useEffect(() => {
    if (!project.inspectionDate) {
      const today = new Date().toISOString().slice(0, 10);
      setLocal((prev) => ({ ...prev, inspectionDate: today }));
    }
  }, [project.id, project.inspectionDate]);

  const latest = useRef(local);
  latest.current = local;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const save = useCallback(async () => {
    const snapshot = latest.current;
    await saveProject(snapshot);
    onProjectChange(snapshot);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }, [onProjectChange]);

  useEffect(() => {
    if (local === project) return;
    const t = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(t);
  }, [local, project, save]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  async function refreshFloors() {
    onFloorsChange(await listFloors(project.id));
  }

  async function addFloor() {
    const name = prompt("Floor name", `Floor ${floors.length + 1}`);
    if (!name) return;
    const now = Date.now();
    await saveFloor({
      id: uid(),
      projectId: project.id,
      name,
      order: floors.length,
      boundary: [],
      createdAt: now,
      updatedAt: now,
    });
    await refreshFloors();
  }

  async function removeFloor(id: string) {
    if (floors.length <= 1) return alert("Keep at least one floor.");
    if (!confirm("Delete this floor and its points?")) return;
    await deleteFloor(id);
    await refreshFloors();
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
    await refreshFloors();
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-[18px] py-[18px]">
      <div>
        <Label className="label-micro">Address</Label>
        <Input
          className={fieldClass}
          value={local.address}
          onChange={(e) => setLocal({ ...local, address: e.target.value })}
          placeholder="Street, City, State — or tap a button below"
        />
        <AddressGpsButtons
          onAddress={(addr) => setLocal((prev) => ({ ...prev, address: addr }))}
        />
      </div>

      <div>
        <Label className="label-micro">Floor plan</Label>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        {activeFloor.planDataUrl ? (
          <div className="relative rounded-xl border border-border bg-card p-2 text-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute right-2 top-2 z-[1] rounded-lg px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: INK, color: PAPER }}
            >
              Change
            </button>
            <img
              src={activeFloor.planDataUrl}
              alt={`${activeFloor.name} plan`}
              className="mx-auto block max-h-[240px] max-w-full rounded-md"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border bg-card px-[18px] py-[30px] text-center text-[14px] text-muted-foreground active:border-foreground active:text-foreground"
          >
            <SetSquareIcon className="mx-auto mb-2 h-[30px] w-[30px]" />
            <div className="font-semibold text-foreground">Tap to upload</div>
            <div className="mt-1 text-[12px]">JPG, PNG or PDF page</div>
          </button>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {activeFloor.name}
          {activeFloor.boundary.length ? ` · ${activeFloor.boundary.length} boundary pts` : ""}
        </p>
      </div>

      <div>
        <Label className="label-micro">Client</Label>
        <Input
          className={fieldClass}
          value={local.client}
          onChange={(e) => setLocal({ ...local, client: e.target.value })}
        />
      </div>

      <div>
        <Label className="label-micro">Survey date</Label>
        <Input
          type="date"
          className={fieldClass}
          value={local.inspectionDate}
          onChange={(e) => setLocal({ ...local, inspectionDate: e.target.value })}
        />
      </div>

      <div>
        <Label className="label-micro">Project name</Label>
        <Input
          className={fieldClass}
          value={local.name}
          onChange={(e) => setLocal({ ...local, name: e.target.value })}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="label-micro mb-0">Levels</Label>
          <button
            type="button"
            onClick={() => void addFloor()}
            className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2 text-[11px] font-semibold"
          >
            + Level
          </button>
        </div>
        <div className="space-y-2">
          {floors.map((f) => (
            <div
              key={f.id}
              className={
                "flex items-center justify-between rounded-[10px] border px-3 py-2 " +
                (f.id === activeFloor.id ? "border-foreground bg-card" : "border-border bg-card")
              }
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onActiveFloorChange(f.id)}
              >
                <div className="text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.planDataUrl ? "Plan uploaded" : "No plan"}
                  {f.boundary.length ? ` · ${f.boundary.length} boundary pts` : ""}
                </div>
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  void removeFloor(f.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {saved ? (
        <p className="text-center text-xs text-muted-foreground">Saved</p>
      ) : null}
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

  // Drag state — works for boundary, saved exclusions, and the in-progress draft.
  const dragRef = useRef<{
    target: "boundary" | "draft" | { exclusionId: string };
    index: number;
    original: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [, force] = useState(0);

  const HIT_RADIUS = 26;

  function findVertexAt(x: number, y: number):
    | { target: "boundary"; index: number }
    | { target: "draft"; index: number }
    | { target: { exclusionId: string }; index: number }
    | null {
    let best:
      | { target: "boundary" | "draft" | { exclusionId: string }; index: number }
      | null = null;
    let bestD2 = HIT_RADIUS * HIT_RADIUS;
    if (tool === "boundary") {
      for (let i = 0; i < boundary.length; i++) {
        const dx = boundary[i].x - x;
        const dy = boundary[i].y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
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
      if (draft) {
        for (let i = 0; i < draft.length; i++) {
          const dx = draft[i].x - x;
          const dy = draft[i].y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= bestD2) {
            bestD2 = d2;
            best = { target: "draft", index: i };
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Tool switcher */}
      <div className="shrink-0 border-b bg-background/70 px-2 py-1.5 flex items-center gap-1 overflow-hidden">
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
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
        <div className="shrink-0 border-b px-2 py-1.5 flex flex-nowrap gap-1.5 overflow-x-auto bg-muted/30 overscroll-x-contain">
          {exclusions.map((ex) => (
            <div
              key={ex.id}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
            >
              <input
                value={ex.label ?? ""}
                onChange={(e) => updateExclusion(ex.id, { label: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="w-28 bg-transparent text-base outline-none border-b border-transparent focus:border-primary sm:w-24"
                placeholder="Label"
                enterKeyHint="done"
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
            const hit = findVertexAt(x, y);
            if (hit) return; // handled as drag
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
          } else if (hit.target === "draft") {
            if (!draft) return false;
            dragRef.current = {
              target: "draft",
              index: hit.index,
              original: { x: draft[hit.index].x, y: draft[hit.index].y },
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
          } else if (drag.target === "draft") {
            setDraft((d) => {
              if (!d) return d;
              const next = d.slice();
              next[drag.index] = { x, y };
              return next;
            });
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
            } else if (drag.target === "draft") {
              setDraft((d) => {
                if (!d) return d;
                const next = d.slice();
                next[drag.index] = drag.original;
                return next;
              });
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
              ctx.arc(p.x, p.y, active ? 12 : 9, 0, Math.PI * 2);
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
                ctx.arc(p.x, p.y, i === dragging ? 11 : 8, 0, Math.PI * 2);
                ctx.fillStyle = i === dragging ? "#f59e0b" : "#4b5563";
                ctx.fill();
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.stroke();
              });
              if (ex.polygon.length > 0 && ex.label) {
                const cx = ex.polygon.reduce((s, p) => s + p.x, 0) / ex.polygon.length;
                const cy = ex.polygon.reduce((s, p) => s + p.y, 0) / ex.polygon.length;
                ctx.font = `bold 12px ${CANVAS_FONT_FAMILY}`;
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
              ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
              ctx.fillStyle = "#4b5563";
              ctx.fill();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = "#111827";
              ctx.font = `bold 10px ${CANVAS_FONT_FAMILY}`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(i + 1), p.x, p.y - 12);
            });
          }
        }}
        refitOnResize={false}
      />
    </div>
  );
}
