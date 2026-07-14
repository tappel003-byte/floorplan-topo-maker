import { getProject, listFloors, listPoints, saveProject, saveFloor, savePoint, uid } from "./db";
import type { Floor, ProjectMeta, SurveyPoint, Transition } from "./types";

const APP_TAG = "floor-survey";
const FORMAT_VERSION = 1;

export interface ProjectExport {
  app: typeof APP_TAG;
  version: number;
  exportedAt: number;
  project: ProjectMeta;
  floors: Floor[];
  points: SurveyPoint[];
}

function sanitize(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "project";
}

/** Build the JSON payload for a project. */
export async function buildProjectExport(projectId: string): Promise<ProjectExport> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");
  const floors = await listFloors(projectId);
  const points: SurveyPoint[] = [];
  for (const f of floors) points.push(...(await listPoints(f.id)));
  return {
    app: APP_TAG,
    version: FORMAT_VERSION,
    exportedAt: Date.now(),
    project,
    floors,
    points,
  };
}

/** Trigger a browser download of the project as JSON. */
export async function exportProjectToFile(projectId: string): Promise<void> {
  const payload = await buildProjectExport(projectId);
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${sanitize(payload.project.name)}-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function validate(payload: unknown): asserts payload is ProjectExport {
  if (!isRecord(payload)) throw new Error("Invalid file: not a JSON object");
  if (payload.app !== APP_TAG) throw new Error("Not a Floor Survey export file");
  if (payload.version !== FORMAT_VERSION)
    throw new Error(`Unsupported file version (${String(payload.version)})`);
  if (!isRecord(payload.project) || typeof payload.project.id !== "string")
    throw new Error("Invalid file: missing project");
  if (!Array.isArray(payload.floors)) throw new Error("Invalid file: missing floors");
  if (!Array.isArray(payload.points)) throw new Error("Invalid file: missing points");
}

/**
 * Import a project export. Always creates a NEW project with fresh IDs.
 * Rewrites all foreign-key references (floorId, transitionId, parentId).
 * Returns the new project id.
 */
export async function importProjectFromFile(file: File): Promise<string> {
  const text = await file.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }
  validate(payload);

  const now = Date.now();
  const newProjectId = uid();

  // Build id maps.
  const floorIdMap = new Map<string, string>();
  for (const f of payload.floors) floorIdMap.set(f.id, uid());
  const transitionIdMap = new Map<string, string>();
  for (const f of payload.floors) {
    for (const t of f.transitions ?? []) transitionIdMap.set(t.id, uid());
  }

  // Persist project.
  const newProject: ProjectMeta = {
    ...payload.project,
    id: newProjectId,
    name: `${payload.project.name} (imported)`,
    createdAt: now,
    updatedAt: now,
  };
  await saveProject(newProject);

  // Persist floors with remapped ids and transition ids.
  for (const f of payload.floors) {
    const newFloorId = floorIdMap.get(f.id)!;
    const remappedTransitions: Transition[] | undefined = f.transitions?.map((t) => ({
      ...t,
      id: transitionIdMap.get(t.id)!,
      parentId: t.parentId ? transitionIdMap.get(t.parentId) ?? undefined : undefined,
    }));
    const remappedNotes = f.notes?.map((n) => ({ ...n, id: uid() }));
    const nextFloor: Floor = {
      ...f,
      id: newFloorId,
      projectId: newProjectId,
      transitions: remappedTransitions,
      notes: remappedNotes,
      createdAt: now,
      updatedAt: now,
    };
    await saveFloor(nextFloor);
  }

  // Persist points with remapped floor and transition ids.
  for (const p of payload.points) {
    const newFloorId = floorIdMap.get(p.floorId);
    if (!newFloorId) continue; // orphan point — skip
    const nextPoint: SurveyPoint = {
      ...p,
      id: uid(),
      floorId: newFloorId,
      transitionId: p.transitionId ? transitionIdMap.get(p.transitionId) ?? undefined : undefined,
    };
    await savePoint(nextPoint);
  }

  return newProjectId;
}
