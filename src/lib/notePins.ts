// Note pins — floor-scoped, persisted to localStorage.
// Separate from IndexedDB survey points so schema changes can't corrupt them.

export interface NotePin {
  id: string;
  x: number; // image coords
  y: number;
  index: number; // 1..N, sequential per floor
  text: string;
  createdAt: number;
}

const KEY = (floorId: string) => `notepins:${floorId}`;

export function loadNotePins(floorId: string): NotePin[] {
  try {
    const raw = localStorage.getItem(KEY(floorId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as NotePin[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveNotePins(floorId: string, pins: NotePin[]) {
  try {
    localStorage.setItem(KEY(floorId), JSON.stringify(pins));
  } catch {}
}

export function reindexNotePins(pins: NotePin[]): NotePin[] {
  return pins.map((p, i) => ({ ...p, index: i + 1 }));
}

export function newNotePinId() {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
