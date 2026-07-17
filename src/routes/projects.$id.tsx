import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePoint, getProject, listFloors, listPoints, savePoint, saveFloor } from "@/lib/db";
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
import { AveragedCorrectionsChip } from "@/components/chrome/AveragedCorrectionsChip";
import { TransitionsSheet } from "@/components/TransitionsSheet";
import { useFloorHistory, useUndoRedoEvents, type FloorSnapshot } from "@/lib/useFloorHistory";
import { withCorrectedValues } from "@/lib/transitions";
import { computeExclusionMap } from "@/lib/exclusions";
import { AlignPlanMode } from "@/components/AlignPlanMode";


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
  // Diagnostic exclusions live at the route so the StatsChip can filter with
  // them on Topo. Session-only: cleared when floor changes or when leaving Topo.
  const [topoExcludedIds, setTopoExcludedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setTopoExcludedIds(new Set());
  }, [activeFloorId]);
  useEffect(() => {
    if (mode !== "topo") setTopoExcludedIds(new Set());
  }, [mode]);
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
      // Legacy migration: transitionDelta() precedence changed so a doorway
      // uses its own measured delta unless it explicitly opts into the group
      // average via `useGroupAverage`. Projects saved before this change had
      // group averages applied globally — preserve their prior behavior by
      // stamping the flag on every transition whose surface pair has an
      // applied average in the stored floor.
      const migrated = fs.map((f) => {
        const avgs = f.transitionGroupAverages;
        if (!avgs || !f.transitions?.length) return f;
        let changed = false;
        const nextT = f.transitions.map((t) => {
          const hasAvg = avgs[`${t.surfaceA}→${t.surfaceB}`] !== undefined;
          if (hasAvg && t.useGroupAverage === undefined) {
            changed = true;
            return { ...t, useGroupAverage: true };
          }
          return t;
        });
        if (!changed) return f;
        const nf = { ...f, transitions: nextT };
        void saveFloor(nf);
        return nf;
      });
      setFloors(migrated);
      if (migrated[0]) setActiveFloorId(migrated[0].id);
      // New projects (no plan uploaded on any floor) land on Setup so the
      // user is guided through Details → Plan → Boundary before Field.
      if (!fs.some((f) => !!f.planDataUrl)) setMode("setup");
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

  const correctedPoints = useMemo(
    () =>
      withCorrectedValues(
        points,
        activeFloor?.transitions,
        activeFloor?.transitionGroupAverages,
      ),
    [points, activeFloor?.transitions, activeFloor?.transitionGroupAverages],
  );

  // Points inside an exclusion zone are dropped from stats and from the topo
  // interpolator. They still render on the plan and appear in Review.
  const exclusionMap = useMemo(
    () => computeExclusionMap(correctedPoints, activeFloor?.exclusions),
    [correctedPoints, activeFloor?.exclusions],
  );
  const nonExcludedPoints = useMemo(
    () => correctedPoints.filter((p) => !exclusionMap.has(p.id)),
    [correctedPoints, exclusionMap],
  );

  const [transitionsSheetOpen, setTransitionsSheetOpen] = useState(false);
  const handleFloorChange = useCallback((f: Floor) => {
    setFloors((prev) => prev.map((p) => (p.id === f.id ? f : p)));
  }, []);
  const handleFloorAveragesChange = useCallback(
    async (f: Floor) => {
      await saveFloor(f);
      handleFloorChange(f);
    },
    [handleFloorChange],
  );

  // Finishing mode: entered via the ⋯ menu ("Finishing") on any project, or via
  // the `#finishing` / `#cleanup` / `#align` URL hashes (the latter two kept
  // for ProjectList's "Replace plan image…" action and existing links).
  // Finishing is the desk-side surface for manipulating data — move points,
  // replace/align the plan image, and jump to Transitions/Review.
  const [finishingOpen, setFinishingOpen] = useState(false);
  useEffect(() => {
    if (!project) return;
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (h === "#finishing" || h === "#cleanup" || h === "#align") {
      setFinishingOpen(true);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [project]);




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
    <div className="relative flex h-[100svh] min-h-[100svh] flex-col overflow-hidden bg-background">
      <AppTopBar
        projectName={project.name}
        floorName={activeFloor.name}
        onOpenSetup={() => setMode("setup")}
        onOpenReview={() => setMode("review")}
        onOpenExport={() => setMode("export")}
        onOpenTransitions={() => setTransitionsSheetOpen(true)}
        onOpenFinishing={() => setFinishingOpen(true)}
        undoEnabled={undoActive && history.canUndo}
        redoEnabled={undoActive && history.canRedo}
      />


      {floors.length > 1 && (
        <div
          data-floor-selector
          className="flex items-center gap-2 px-2 h-7 text-xs border-b bg-background/70"
        >
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
            onStartSurveying={() => setMode("field")}
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
            labelFontSize={settings.pointLabelFontSize}
            focusRequest={focusRequest}
            onCommit={(snap) => history.commit(snap)}
          />
        )}
        {mode === "review" && (
          <ReviewTab
            floor={activeFloor}
            points={points}
            correctedById={new Map(correctedPoints.map((p) => [p.id, p.value]))}
            zoneLabelById={
              new Map(
                Array.from(exclusionMap.entries()).map(([id, z]) => [id, z.label ?? ""]),
              )
            }
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
            points={correctedPoints}
            onPointsChange={setPoints}
            onFloorChange={(f) => setFloors((prev) => prev.map((p) => (p.id === f.id ? f : p)))}
            settings={settings}
            onSettingsChange={setSettings}
            pointSize={pointSize}
            pointColor={pointColor}
            selectedIds={topoHighlightIds}
            excludedIds={topoExcludedIds}
            onExcludedIdsChange={setTopoExcludedIds}
          />
        )}
        {mode === "export" && (
          <ExportTab
            project={project}
            floor={activeFloor}
            points={correctedPoints}
            settings={settings}
          />
        )}
      </main>

      {(mode === "field" || mode === "topo") && (
        <>
          <ModeToggle
            mode={mode === "topo" ? "topo" : "data"}
            onChange={(m) => setMode(m === "topo" ? "topo" : "field")}
          />
          <StatsChip
            points={
              mode === "topo" && topoExcludedIds.size
                ? nonExcludedPoints.filter((p) => !topoExcludedIds.has(p.id))
                : nonExcludedPoints
            }
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
          hasFloorSelector={floors.length > 1}
          projectId={project.id}
          points={points}
          correctedById={new Map(correctedPoints.map((p) => [p.id, p.value]))}
          floor={activeFloor}
          selectedIds={selectedIds}
          pointSize={pointSize}
          onPointSizeChange={setPointSize}
          pointColor={pointColor}
          onPointColorChange={setPointColor}
          labelFontSize={settings.pointLabelFontSize}
          onLabelFontSizeChange={(n) => setSettings((s) => ({ ...s, pointLabelFontSize: n }))}
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

      {(mode === "field" || mode === "topo") && (
        <AveragedCorrectionsChip
          floor={activeFloor}
          storageKey={`avg-chip:${activeFloor.id}:${mode}`}
          onManage={() => setTransitionsSheetOpen(true)}
        />
      )}
      <TransitionsSheet
        open={transitionsSheetOpen}
        floor={activeFloor}
        points={points}
        onClose={() => setTransitionsSheetOpen(false)}
        onFloorChange={handleFloorAveragesChange}
      />
      {finishingOpen && (
        <AlignPlanMode
          title="Finishing"
          floor={activeFloor}
          points={points}
          pointColor={pointColor}
          pointSize={pointSize}
          onOpenTransitions={() => {
            setFinishingOpen(false);
            setTransitionsSheetOpen(true);
          }}
          onOpenReview={() => {
            setFinishingOpen(false);
            setMode("review");
          }}
          onDone={(nextFloor, updatedPoints) => {
            setFloors((prev) => prev.map((f) => (f.id === nextFloor.id ? nextFloor : f)));
            setPoints(updatedPoints);
            setFinishingOpen(false);
          }}
          onCancel={() => setFinishingOpen(false)}
        />
      )}

    </div>
  );
}

