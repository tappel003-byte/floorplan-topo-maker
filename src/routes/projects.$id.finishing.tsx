import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import {
  getProject,
  listFloors,
  listPoints,
  saveFloor,
  savePoint,
  deletePoint,
} from "@/lib/db";
import type { Floor, ProjectMeta, RenderSettings, SurveyPoint } from "@/lib/types";
import { defaultRenderSettings } from "@/lib/types";
import { TopoTab } from "@/components/tabs/TopoTab";
import { TopoDiagnosticPanel } from "@/components/TopoDiagnosticPanel";
import { withCorrectedValues } from "@/lib/transitions";
import { computeExclusionMap } from "@/lib/exclusions";
import { bundleFilename, downloadBundle, exportProject } from "@/lib/bundle";
import { saveProject } from "@/lib/db";

export const Route = createFileRoute("/projects/$id/finishing")({
  head: () => ({
    meta: [
      { title: "Finishing · Floor Survey" },
      {
        name: "description",
        content:
          "Desktop finishing workspace for Floor Survey — style contours, adjust labels, review data, and export.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinishingWorkspace,
});

const MIN_DESKTOP_WIDTH = 1024;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.innerWidth >= MIN_DESKTOP_WIDTH,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setIsDesktop(window.innerWidth >= MIN_DESKTOP_WIDTH);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return isDesktop;
}

function FinishingWorkspace() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [diagOpen, setDiagOpen] = useState(true);

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
    (async () => {
      const pts = await listPoints(activeFloor.id);
      setPoints(pts);
    })();
  }, [activeFloor?.id]);

  // Seed finishingSettings from current renderSettings-style defaults if
  // absent. Persists to Floor.finishingSettings so the state survives reloads
  // and roundtrips through the bundle exporter.
  const finishingSettings: RenderSettings = useMemo(
    () => activeFloor?.finishingSettings ?? defaultRenderSettings,
    [activeFloor?.finishingSettings],
  );

  const commitFloor = useCallback(
    async (next: Floor) => {
      setFloors((prev) => prev.map((f) => (f.id === next.id ? next : f)));
      await saveFloor(next);
    },
    [],
  );

  const onSettingsChange = useCallback(
    (next: RenderSettings) => {
      if (!activeFloor) return;
      void commitFloor({ ...activeFloor, finishingSettings: next, updatedAt: Date.now() });
    },
    [activeFloor, commitFloor],
  );

  const onFloorChange = useCallback(
    (next: Floor) => {
      void commitFloor(next);
    },
    [commitFloor],
  );

  const onPointsChange = useCallback(
    async (nextPoints: SurveyPoint[]) => {
      // Diff against current points to persist adds / edits / deletes.
      const prevIds = new Set(points.map((p) => p.id));
      const nextIds = new Set(nextPoints.map((p) => p.id));
      for (const p of points) {
        if (!nextIds.has(p.id)) await deletePoint(p.id);
      }
      for (const p of nextPoints) {
        const prev = points.find((q) => q.id === p.id);
        if (!prev || prev !== p) await savePoint(p);
      }
      void prevIds;
      setPoints(nextPoints);
    },
    [points],
  );

  const correctedPoints = useMemo(
    () =>
      withCorrectedValues(
        points,
        activeFloor?.transitions,
        activeFloor?.transitionGroupAverages,
      ),
    [points, activeFloor?.transitions, activeFloor?.transitionGroupAverages],
  );

  const exclusionMap = useMemo(
    () => computeExclusionMap(correctedPoints, activeFloor?.exclusions),
    [correctedPoints, activeFloor?.exclusions],
  );

  const onExport = useCallback(async () => {
    if (!project) return;
    try {
      const blob = await exportProject(project.id);
      downloadBundle(blob, bundleFilename(project.name));
      await saveProject({ ...project, lastExportedAt: Date.now() });
      setProject({ ...project, lastExportedAt: Date.now() });
    } catch {
      /* ignore */
    }
  }, [project]);

  const onResetToDefaults = useCallback(() => {
    if (!activeFloor) return;
    if (!confirm("Reset Finishing settings to defaults? This does not touch your Field view."))
      return;
    void commitFloor({ ...activeFloor, finishingSettings: undefined, updatedAt: Date.now() });
  }, [activeFloor, commitFloor]);

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

  if (!isDesktop) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 shadow-sm text-center space-y-3">
          <h1 className="text-lg font-semibold">Open Finishing on a desktop</h1>
          <p className="text-sm text-muted-foreground">
            Finishing is designed for a large screen (≥ {MIN_DESKTOP_WIDTH}px wide). Copy the
            link below and open it on your computer.
          </p>
          <div className="rounded border bg-muted/40 p-2 text-xs break-all">{url}</div>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(url);
                }
              }}
            >
              Copy link
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm hover:bg-accent"
              onClick={() => navigate({ to: "/projects/$id", params: { id } })}
            >
              Back to project
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activePoints = correctedPoints.filter((p) => !exclusionMap.has(p.id));

  return (
    <div className="relative flex h-[100svh] min-h-[100svh] flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 h-11 bg-background/90 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate({ to: "/projects/$id", params: { id } })}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Back to Field"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Field</span>
        </button>
        <div className="flex-1 min-w-0 truncate text-sm">
          <span className="font-medium">{project.name}</span>
          <span className="text-muted-foreground"> · {activeFloor.name} · Finishing</span>
        </div>
        {floors.length > 1 && (
          <select
            className="rounded border bg-background px-2 py-1 text-xs"
            value={activeFloorId ?? ""}
            onChange={(e) => setActiveFloorId(e.target.value)}
          >
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={onResetToDefaults}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Reset Finishing settings to defaults"
        >
          Reset settings
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded bg-primary text-primary-foreground px-3 py-1 text-sm hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </header>

      {/* Body: 3-column layout */}
      <div className="grid flex-1 min-h-0 grid-cols-[260px_minmax(0,1fr)_260px]">
        {/* LEFT: data */}
        <aside className="flex flex-col border-r bg-muted/20 min-h-0">
          <div className="flex items-center justify-between px-3 h-9 border-b">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Data
            </span>
            <span className="text-[11px] text-muted-foreground">{activePoints.length} pts</span>
          </div>
          <PointList
            points={correctedPoints}
            excludedIds={exclusionMap}
            selectedIds={selectedIds}
            onSelect={(id) => setSelectedIds(new Set([id]))}
          />
        </aside>

        {/* CENTER: canvas (TopoTab hosts canvas + its own corner setting panels) */}
        <main className="relative min-h-0 min-w-0 bg-white">
          <TopoTab
            floor={activeFloor}
            points={points}
            onPointsChange={onPointsChange}
            onFloorChange={onFloorChange}
            settings={finishingSettings}
            onSettingsChange={onSettingsChange}
            selectedIds={selectedIds}
            pointSize={2}
            pointColor="#dc2626"
            excludedIds={excludedIds}
            onExcludedIdsChange={setExcludedIds}
          />
        </main>

        {/* RIGHT: diagnostics + info */}
        <aside className="flex flex-col border-l bg-muted/20 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between px-3 h-9 border-b">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Diagnostics
            </span>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setDiagOpen((v) => !v)}
            >
              {diagOpen ? "Hide" : "Show"}
            </button>
          </div>
          {diagOpen && (
            <div className="p-3 space-y-3 text-xs">
              <StatsCard points={activePoints} />
              <InfoCard
                label="Boundary"
                value={
                  activeFloor.boundary?.length
                    ? `${activeFloor.boundary.length} vertices`
                    : "none"
                }
              />
              <InfoCard
                label="Exclusion zones"
                value={`${activeFloor.exclusions?.length ?? 0}`}
              />
              <InfoCard
                label="Transitions"
                value={`${activeFloor.transitions?.length ?? 0}`}
              />
              <div className="pt-2 border-t space-y-1.5">
                <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                  Settings groups
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Use the corner icons over the canvas to open the{" "}
                  <span className="text-foreground">Contours</span>,{" "}
                  <span className="text-foreground">Palette</span>, and{" "}
                  <span className="text-foreground">Labels</span> panels. All changes here are
                  isolated from the Field view.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Optional floating diagnostic overlay for point-level exclude/restore */}
      {false && (
        <TopoDiagnosticPanel
          points={correctedPoints}
          excludedIds={excludedIds}
          onToggleExclude={(pid) => {
            const next = new Set(excludedIds);
            if (next.has(pid)) next.delete(pid);
            else next.add(pid);
            setExcludedIds(next);
          }}
          onRestoreAll={() => setExcludedIds(new Set())}
          onClose={() => setDiagOpen(false)}
        />
      )}
    </div>
  );
}

function PointList({
  points,
  excludedIds,
  selectedIds,
  onSelect,
}: {
  points: SurveyPoint[];
  excludedIds: Map<string, string> | Set<string>;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const [sortMode, setSortMode] = useState<"index" | "high" | "low">("index");
  const sorted = useMemo(() => {
    const arr = [...points];
    if (sortMode === "high") arr.sort((a, b) => b.value - a.value);
    else if (sortMode === "low") arr.sort((a, b) => a.value - b.value);
    else arr.sort((a, b) => a.index - b.index);
    return arr;
  }, [points, sortMode]);
  const isExcluded = (id: string) =>
    excludedIds instanceof Set ? excludedIds.has(id) : excludedIds.has(id);
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b text-[11px]">
        <button
          type="button"
          onClick={() => setSortMode("index")}
          className={`rounded px-1.5 py-0.5 ${sortMode === "index" ? "bg-accent" : "hover:bg-accent/60"}`}
        >
          PIN
        </button>
        <button
          type="button"
          onClick={() => setSortMode("high")}
          className={`rounded px-1.5 py-0.5 ${sortMode === "high" ? "bg-accent" : "hover:bg-accent/60"}`}
        >
          High
        </button>
        <button
          type="button"
          onClick={() => setSortMode("low")}
          className={`rounded px-1.5 py-0.5 ${sortMode === "low" ? "bg-accent" : "hover:bg-accent/60"}`}
        >
          Low
        </button>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto divide-y text-xs">
        {sorted.map((p) => {
          const excluded = isExcluded(p.id);
          const selected = selectedIds.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={`w-full grid grid-cols-[2.25rem_1fr_auto] items-center gap-2 px-2 py-1.5 text-left ${
                  selected ? "bg-primary/10" : "hover:bg-accent/60"
                } ${excluded ? "opacity-40" : ""}`}
              >
                <span className="tabular-nums text-muted-foreground">#{p.index}</span>
                <span className="tabular-nums font-mono">{p.value.toFixed(2)}</span>
                <span className="tabular-nums text-[10px] text-muted-foreground">
                  {Math.round(p.x)},{Math.round(p.y)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatsCard({ points }: { points: SurveyPoint[] }) {
  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, mean, range: max - min, count: vals.length };
  }, [points]);
  if (!stats) {
    return <p className="text-muted-foreground">No points on this floor yet.</p>;
  }
  return (
    <div className="rounded border bg-background p-2 space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">High</span>
        <span className="font-mono tabular-nums">{stats.max.toFixed(2)}"</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Low</span>
        <span className="font-mono tabular-nums">{stats.min.toFixed(2)}"</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Δ</span>
        <span className="font-mono tabular-nums">{stats.range.toFixed(2)}"</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Mean</span>
        <span className="font-mono tabular-nums">{stats.mean.toFixed(2)}"</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Count</span>
        <span className="font-mono tabular-nums">{stats.count}</span>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded border bg-background px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
