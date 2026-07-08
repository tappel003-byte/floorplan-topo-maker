import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Settings2, Pointer, ListChecks, Layers3, Share2 } from "lucide-react";
import { getProject, listFloors, listPoints } from "@/lib/db";
import type { Floor, ProjectMeta, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { SetupTab } from "@/components/tabs/SetupTab";
import { FieldTab } from "@/components/tabs/FieldTab";
import { ReviewTab } from "@/components/tabs/ReviewTab";
import { TopoTab } from "@/components/tabs/TopoTab";
import { ExportTab } from "@/components/tabs/ExportTab";

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
  const [mode, setMode] = useState<Mode>("setup");
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
    <div className="flex flex-col h-[100dvh] relative">
      <header className="bg-background/85 backdrop-blur border-b">
        <div className="flex items-center gap-2 px-2 h-8 text-xs">
          <Link
            to="/"
            className="inline-flex items-center text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Back to projects"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0 truncate">
            <span className="font-medium">{project.name}</span>
            <span className="text-muted-foreground"> · {activeFloor.name}</span>
          </div>
          {floors.length > 1 && (
            <select
              value={activeFloor.id}
              onChange={(e) => setActiveFloorId(e.target.value)}
              className="rounded border px-1.5 py-0.5 text-xs bg-background max-w-[8rem] truncate"
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

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

      <nav
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 rounded-full bg-background/90 backdrop-blur border shadow-lg px-1 py-1"
        aria-label="Sections"
      >
        <ModeBtn active={mode === "setup"} onClick={() => setMode("setup")} icon={<Settings2 className="h-4 w-4" />} label="Setup" />
        <ModeBtn active={mode === "field"} onClick={() => setMode("field")} icon={<Pointer className="h-4 w-4" />} label="Field" />
        <ModeBtn active={mode === "review"} onClick={() => setMode("review")} icon={<ListChecks className="h-4 w-4" />} label="Review" />
        <ModeBtn active={mode === "topo"} onClick={() => setMode("topo")} icon={<Layers3 className="h-4 w-4" />} label="Topo" />
        <ModeBtn active={mode === "export"} onClick={() => setMode("export")} icon={<Share2 className="h-4 w-4" />} label="Export" />
      </nav>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 h-9 px-3 rounded-full text-xs transition-colors " +
        (active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:text-foreground")
      }
      aria-label={label}
    >
      {icon}
      <span className={active ? "" : "hidden sm:inline"}>{label}</span>
    </button>
  );
}
