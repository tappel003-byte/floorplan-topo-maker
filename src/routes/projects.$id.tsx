import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePoint, getProject, listFloors, listPoints, saveFloor, savePoint } from "@/lib/db";
import type { Floor, ProjectMeta, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { SetupTab } from "@/components/tabs/SetupTab";
import { FieldTab } from "@/components/tabs/FieldTab";
import { ReviewTab } from "@/components/tabs/ReviewTab";
import { TopoTab } from "@/components/tabs/TopoTab";
import { ExportTab } from "@/components/tabs/ExportTab";
import { AppTopBar } from "@/components/chrome/AppTopBar";
import { ModeToggle } from "@/components/chrome/ModeToggle";
import { NoteTool } from "@/components/chrome/NoteTool";
import { DataPointsPanel } from "@/components/DataPointsPanel";
import { useFloorHistory, useUndoRedoEvents, type FloorSnapshot } from "@/lib/useFloorHistory";


type Mode = "setup" | "field" | "review" | "topo" | "export";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project · Floor Survey" },
      { name: "robots", content: "noindex" },
    ],
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
  const [focusRequest, setFocusRequest] = useState<{ x: number; y: number; nonce: number } | undefined>(undefined);
  const [pointSize, setPointSize] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(`dpp-size:${id}`);
      const n = raw ? Number(raw) : 2;
      return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 2;
    } catch { return 2; }
  });
  useEffect(() => {
    try { localStorage.setItem(`dpp-size:${id}`, String(pointSize)); } catch {}
  }, [pointSize, id]);
  const [pointColor, setPointColor] = useState<string>(() => {
    try {
      return localStorage.getItem(`dpp-color:${id}`) || "#dc2626";
    } catch { return "#dc2626"; }
  });
  useEffect(() => {
    try { localStorage.setItem(`dpp-color:${id}`, pointColor); } catch {}
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
  const [notesVersion, setNotesVersion] = useState(0);

  useEffect(() => {
    if (!activeFloor) return;
    (async () => {
      const pts = await listPoints(activeFloor.id);
      setPoints(pts);
      history.seed({ points: pts, notePins: activeFloor.notePins ?? [] });
    })();
  }, [activeFloor?.id]);

  const applySnapshot = useCallback(
    async (snap: FloorSnapshot) => {
      if (!activeFloor) return;
      const floorId = activeFloor.id;
      // Diff points
      const nextIds = new Set(snap.points.map((p) => p.id));
      for (const p of points) {
        if (!nextIds.has(p.id)) await deletePoint(p.id);
      }
      for (const p of snap.points) await savePoint(p);
      setPoints(snap.points);
      // Note pins live on the floor record
      const nextFloor: Floor = { ...activeFloor, notePins: snap.notePins };
      await saveFloor(nextFloor);
      setFloors((prev) => prev.map((f) => (f.id === floorId ? nextFloor : f)));
      setNotesVersion((n) => n + 1);
    },
    [activeFloor, points],
  );

  const undoActive = mode === "field" || mode === "review";
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
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            pointSize={pointSize}
            pointColor={pointColor}
            focusRequest={focusRequest}
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
            selectedIds={selectedIds}
          />
        )}
        {mode === "export" && (
          <ExportTab project={project} floor={activeFloor} points={points} settings={settings} />
        )}
      </main>

      {mode !== "setup" && mode !== "export" && (
        <ModeToggle
          mode={mode === "topo" ? "topo" : "data"}
          onChange={(m) => setMode(m === "topo" ? "topo" : "field")}
        />
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

          onSelect={(pid, additive) => {
            if (additive) {
              const next = new Set(selectedIds);
              next.has(pid) ? next.delete(pid) : next.add(pid);
              setSelectedIds(next);
            } else {
              setSelectedIds(new Set([pid]));
              const p = points.find((pt) => pt.id === pid);
              if (p) setFocusRequest({ x: p.x, y: p.y, nonce: Date.now() });
            }
          }}
        />
      )}

      {mode === "field" && <NoteTool />}

    </div>
  );
}
