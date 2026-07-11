import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePoint, getProject, listFloors, listPoints, savePoint } from "@/lib/db";
import type { Floor, ProjectMeta, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { SetupTab } from "@/components/tabs/SetupTab";
import { FieldTab } from "@/components/tabs/FieldTab";
import { ReviewTab } from "@/components/tabs/ReviewTab";
import { TopoTab } from "@/components/tabs/TopoTab";
import { ExportTab } from "@/components/tabs/ExportTab";
import { AppTopBar } from "@/components/chrome/AppTopBar";
import { ModeToggle } from "@/components/chrome/ModeToggle";
import { DataPointsPanel } from "@/components/DataPointsPanel";
import { StatsChip } from "@/components/chrome/StatsChip";
import { useFloorHistory, useUndoRedoEvents, type FloorSnapshot } from "@/lib/useFloorHistory";
import { withCorrectedValues } from "@/lib/transitions";

type Mode = "setup" | "field" | "review" | "topo" | "export";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [{ title: "Project · Floor Survey" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectWorkspace,
});

function ProjectWorkspace() {
  const { id } = Route.useParams();
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [mode, setMode] = useState<Mode>("field");
  const [settings, setSettings] = useState<RenderSettings>(defaultRenderSettings);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [topoHighlightIds, setTopoHighlightIds] = useState<Set<string>>(new Set());
  const [focusRequest, setFocusRequest] = useState<
    { x: number; y: number; nonce: number } | undefined
  >(undefined);
  const [pointSize, setPointSize] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(`dpp-size:${id}`);
      const n = raw ? Number(raw) : 2;
      return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 2;
    } catch {
      return 2;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`dpp-size:${id}`, String(pointSize));
    } catch {
      /* ignore */
    }
  }, [pointSize, id]);
  const [pointColor, setPointColor] = useState<string>(() => {
    try {
      return localStorage.getItem(`dpp-color:${id}`) || "#dc2626";
    } catch {
      return "#dc2626";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`dpp-color:${id}`, pointColor);
    } catch {
      /* ignore */
    }
  }, [pointColor, id]);

  useEffect(() => {
    (async () => {
      const p = await getProject(id);
      if (!p) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setProject(p);
      const fs = await listFloors(id);
      setFloors(fs);
      if (fs[0]) setActiveFloorId(fs[0].id);
      setLoading(false);
    })();
  }, [id]);

  const activeFloor = useMemo(
    () => floors.find((f) => f.id === activeFloorId) ?? null,
    [floors, activeFloorId],
  );

  const history = useFloorHistory(activeFloorId);

  useEffect(() => {
    if (!activeFloor) return;
    (async () => {
      const pts = await listPoints(activeFloor.id);
      setPoints(pts);
      history.seed({ points: pts });
    })();
  }, [activeFloor?.id]);

  const applySnapshot = useCallback(
    async (snap: FloorSnapshot) => {
      if (!activeFloor) return;
      // Diff points
      const nextIds = new Set(snap.points.map((p) => p.id));
      for (const p of points) {
        if (!nextIds.has(p.id)) await deletePoint(p.id);
      }
      for (const p of snap.points) await savePoint(p);
      setPoints(snap.points);
    },
    [activeFloor, points],
  );

  const undoActive = mode === "field" || mode === "review" || mode === "topo";
  const onUndo = useCallback(() => {
    if (!undoActive) return;
    const snap = history.undo();
    if (snap) void applySnapshot(snap);
  }, [undoActive, history, applySnapshot]);
  const onRedo = useCallback(() => {
    if (!undoActive) return;
    const snap = history.redo();
    if (snap) void applySnapshot(snap);
  }, [undoActive, history, applySnapshot]);
  useUndoRedoEvents(onUndo, onRedo);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (missing || !project) {
    return (
      <div className="p-6">
        <p className="text-sm mb-3">Project not found.</p>
        <Link to="/" className="text-primary underline">
          Back to projects
        </Link>
      </div>
    );
  }
  if (!activeFloor) {
    return <div className="p-6 text-sm">No floors in this project.</div>;
  }

  return (
    <div className="flex flex-col h-[100dvh] relative bg-background">
      <AppTopBar
        projectName={project.name}
        floorName={activeFloor.name}
        onOpenSetup={() => setMode("setup")}
        onOpenReview={() => setMode("review")}
        onOpenExport={() => setMode("export")}
        undoEnabled={undoActive && history.canUndo}
        redoEnabled={undoActive && history.canRedo}
      />
      {floors.length > 1 && (
        <div className="flex items-center gap-2 px-2 h-7 text-xs border-b bg-background/70">
          <span className="text-muted-foreground">Floor</span>
          <select
            value={activeFloor.id}
            onChange={(e) => setActiveFloorId(e.target.value)}
            className="rounded border px-1.5 py-0.5 text-xs bg-background max-w-[10rem] truncate"
          >
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden relative">
        {mode === "setup" && (
          <SetupTab
            project={project}
            floors={floors}
            activeFloor={activeFloor}
            onProjectChange={setProject}
            onFloorsChange={(fs) => {
              setFloors(fs);
              if (!fs.find((f) => f.id === activeFloorId)) setActiveFloorId(fs[0]?.id ?? null);
            }}
            onActiveFloorChange={setActiveFloorId}
          />
        )}
        {mode === "field" && (
          <FieldTab
            projectId={project.id}
            floor={activeFloor}
            points={points}
            onPointsChange={setPoints}
            onFloorChange={(f) => setFloors((prev) => prev.map((p) => (p.id === f.id ? f : p)))}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            pointSize={pointSize}
            pointColor={pointColor}
            focusRequest={focusRequest}
            onCommit={(snap) => history.commit(snap)}
          />
        )}
        {mode === "review" && (
          <ReviewTab
            floor={activeFloor}
            points={points}
            onPointsChange={setPoints}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onClose={() => setMode("field")}
            onCommit={(pts) => history.commit({ points: pts })}
          />
        )}
        {mode === "topo" && (
          <TopoTab
            floor={activeFloor}
            points={points}
            onPointsChange={setPoints}
            onFloorChange={(f) => setFloors((prev) => prev.map((p) => (p.id === f.id ? f : p)))}
            settings={settings}
            onSettingsChange={setSettings}
            pointSize={pointSize}
            selectedIds={topoHighlightIds}
          />
        )}
        {mode === "export" && (
          <ExportTab project={project} floor={activeFloor} points={points} settings={settings} />
        )}
      </main>

      {(mode === "field" || mode === "topo") && (
        <>
          <ModeToggle
            mode={mode === "topo" ? "topo" : "data"}
            onChange={(m) => setMode(m === "topo" ? "topo" : "field")}
          />
          <StatsChip
            points={points}
            onHighlight={(p) => {
              if (mode === "field") {
                setSelectedIds(new Set([p.id]));
                setFocusRequest({ x: p.x, y: p.y, nonce: Date.now() });
              } else {
                setTopoHighlightIds(new Set([p.id]));
              }
            }}
          />
        </>
      )}
      {mode === "field" && (
        <DataPointsPanel
          projectId={project.id}
          points={points}
          selectedIds={selectedIds}
          pointSize={pointSize}
          onPointSizeChange={setPointSize}
          pointColor={pointColor}
          onPointColorChange={setPointColor}
          onPointsChange={setPoints}
          onCommit={(pts) => history.commit({ points: pts })}
          onSelect={(pid, additive) => {
            if (additive) {
              const next = new Set(selectedIds);
              if (next.has(pid)) next.delete(pid);
              else next.add(pid);
              setSelectedIds(next);
            } else {
              setSelectedIds(new Set([pid]));
              const p = points.find((pt) => pt.id === pid);
              if (p) setFocusRequest({ x: p.x, y: p.y, nonce: Date.now() });
            }
          }}
        />
      )}
    </div>
  );
}
