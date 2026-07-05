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
    <div className="flex flex-col h-[100dvh]">
      <header className="border-b bg-background">
        <div className="flex items-center gap-3 px-3 h-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Projects
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{project.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {activeFloor.name} · {project.inspectionDate}
            </div>
          </div>
          {floors.length > 1 && (
            <select
              value={activeFloor.id}
              onChange={(e) => setActiveFloorId(e.target.value)}
              className="rounded-md border px-2 py-1 text-sm bg-background"
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

      <main className="flex-1 min-h-0 overflow-hidden">
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
          <FieldTab floor={activeFloor} points={points} onPointsChange={setPoints} />
        )}
        {mode === "review" && (
          <ReviewTab floor={activeFloor} points={points} onPointsChange={setPoints} />
        )}
        {mode === "topo" && (
          <TopoTab
            floor={activeFloor}
            points={points}
            settings={settings}
            onSettingsChange={setSettings}
          />
        )}
        {mode === "export" && (
          <ExportTab project={project} floor={activeFloor} points={points} settings={settings} />
        )}
      </main>

      <nav className="border-t bg-background grid grid-cols-5 shrink-0 pb-[env(safe-area-inset-bottom)]">
        <ModeBtn
          active={mode === "setup"}
          onClick={() => setMode("setup")}
          icon={<Settings2 className="h-5 w-5" />}
          label="Setup"
        />
        <ModeBtn
          active={mode === "field"}
          onClick={() => setMode("field")}
          icon={<Pointer className="h-5 w-5" />}
          label="Field"
        />
        <ModeBtn
          active={mode === "review"}
          onClick={() => setMode("review")}
          icon={<ListChecks className="h-5 w-5" />}
          label="Review"
        />
        <ModeBtn
          active={mode === "topo"}
          onClick={() => setMode("topo")}
          icon={<Layers3 className="h-5 w-5" />}
          label="Topo"
        />
        <ModeBtn
          active={mode === "export"}
          onClick={() => setMode("export")}
          icon={<Share2 className="h-5 w-5" />}
          label="Export"
        />
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
        "flex flex-col items-center justify-center py-2 gap-0.5 text-xs " +
        (active ? "text-primary" : "text-muted-foreground")
      }
    >
      {icon}
      <span className={active ? "font-medium" : ""}>{label}</span>
    </button>
  );
}
