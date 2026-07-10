import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Floor, ProjectMeta, SurveyPoint } from "./types";

interface FloorSurveyDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectMeta;
    indexes: { updatedAt: number };
  };
  floors: {
    key: string;
    value: Floor;
    indexes: { projectId: string };
  };
  points: {
    key: string;
    value: SurveyPoint;
    indexes: { floorId: string };
  };
}

let dbPromise: Promise<IDBPDatabase<FloorSurveyDB>> | null = null;

function getDB() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB not available");
  }
  if (!dbPromise) {
    dbPromise = openDB<FloorSurveyDB>("floor-survey", 3, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const p = db.createObjectStore("projects", { keyPath: "id" });
          p.createIndex("updatedAt", "updatedAt");
          const f = db.createObjectStore("floors", { keyPath: "id" });
          f.createIndex("projectId", "projectId");
          const pt = db.createObjectStore("points", { keyPath: "id" });
          pt.createIndex("floorId", "floorId");
        }
        // v2 introduced a "transitions" store; v3 removes it and strips
        // any transition-related fields left on existing points.
        if (oldVersion < 3) {
          if (db.objectStoreNames.contains("transitions" as never)) {
            db.deleteObjectStore("transitions" as never);
          }
          // Scrub legacy transition fields from stored points.
          const store = tx.objectStore("points");
          store.openCursor().then(async function walk(cursor): Promise<void> {
            if (!cursor) return;
            const v = cursor.value as SurveyPoint & Record<string, unknown>;
            let dirty = false;
            for (const k of ["raw", "offset", "transitionId", "isTransitionAnchor"]) {
              if (k in v) { delete v[k]; dirty = true; }
            }
            if (dirty) await cursor.update(v);
            const next = await cursor.continue();
            return walk(next);
          });
        }
      },
    });
  }
  return dbPromise;
}

// Projects
export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await getDB();
  const all = await db.getAll("projects");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getProject(id: string) {
  const db = await getDB();
  return db.get("projects", id);
}
export async function saveProject(p: ProjectMeta) {
  const db = await getDB();
  await db.put("projects", { ...p, updatedAt: Date.now() });
}
export async function deleteProject(id: string) {
  const db = await getDB();
  const floors = await listFloors(id);
  for (const f of floors) await deleteFloor(f.id);
  await db.delete("projects", id);
}

// Floors
export async function listFloors(projectId: string): Promise<Floor[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("floors", "projectId", projectId);
  return all.sort((a, b) => a.order - b.order);
}
export async function getFloor(id: string) {
  const db = await getDB();
  return db.get("floors", id);
}
export async function saveFloor(f: Floor) {
  const db = await getDB();
  await db.put("floors", { ...f, updatedAt: Date.now() });
}
export async function deleteFloor(id: string) {
  const db = await getDB();
  const points = await listPoints(id);
  for (const p of points) await db.delete("points", p.id);
  await db.delete("floors", id);
}

// Points
export async function listPoints(floorId: string): Promise<SurveyPoint[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("points", "floorId", floorId);
  return all.sort((a, b) => a.index - b.index);
}
export async function savePoint(p: SurveyPoint) {
  const db = await getDB();
  await db.put("points", p);
}
export async function deletePoint(id: string) {
  const db = await getDB();
  await db.delete("points", id);
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
