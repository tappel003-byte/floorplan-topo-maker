import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getProject, listFloors, listPoints } from "@/lib/db";
import type { Floor, ProjectMeta, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { SetupTab } from "@/components/tabs/SetupTab";
import { FieldTab } from "@/components/tabs/FieldTab";
import { ReviewTab } from "@/components/tabs/ReviewTab";
import { TopoTab } from "@/components/tabs/TopoTab";
import { ExportTab } from "@/components/tabs/ExportTab";
import { AppTopBar } from "@/components/chrome/AppTopBar";
import { ModeToggle } from "@/components/chrome/ModeToggle";
import { ReviewShortcut } from "@/components/chrome/ReviewShortcut";
import { NoteTool } from "@/components/chrome/NoteTool";

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

  useEffect(() => {
    if (!activeFloor) return;
    (async () => setPoints(await listPoints(activeFloor.id)))();
  }, [activeFloor?.id]);

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
        projectId={project.id}
        projectName={project.name}
        floorName={activeFloor.name}
        activeFloorId={activeFloor.id}
        onOpenSetup={() => setMode("setup")}
        onOpenReview={() => setMode("review")}
        onOpenExport={() => setMode("export")}
        onPointsCleared={() => setPoints([])}
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
          />
        )}
        {mode === "review" && (
          <ReviewTab
            floor={activeFloor}
            points={points}
            onPointsChange={setPoints}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
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
        <>
          <ReviewShortcut
            points={points}
            selectedIds={selectedIds}
            onOpen={() => setMode("review")}
          />
          <NoteTool />
        </>
      )}
    </div>
  );
}
