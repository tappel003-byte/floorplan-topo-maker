// Floor Survey — domain types

export type Mode = "setup" | "field" | "review" | "topo" | "export";

export interface ProjectMeta {
  id: string;
  name: string;
  address: string;
  client: string;
  inspector: string;
  inspectionDate: string; // ISO date
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Floor {
  id: string;
  projectId: string;
  name: string; // "1st Floor", "Basement", etc.
  order: number;
  // Plan image
  planDataUrl?: string; // stored as data URL for offline-first
  planWidth?: number;
  planHeight?: number;
  // Boundary polygon in image coordinates
  boundary: Array<{ x: number; y: number }>;
  // Scale calibration
  scale?: {
    // two points and the known real-world length in inches between them
    a: { x: number; y: number };
    b: { x: number; y: number };
    lengthInches: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface SurveyPoint {
  id: string;
  floorId: string;
  index: number; // display number, 1..n
  x: number; // image coords
  y: number;
  value: number; // elevation in inches (BP default 9.0)
  isBasePoint?: boolean;
  label?: string; // BP1, BP2, etc.
  createdAt: number;
}

export interface RenderSettings {
  mode: "contour-fill" | "contour-cells" | "contour-bw" | "points-only";
  interval: number; // contour interval in inches
  sharpness: number; // IDW power: 1 = very smooth, 5 = very local/sharp
  showPlan: boolean;
  planOpacity: number;
  showContours: boolean;
  contourOpacity: number;
  showLabels: boolean;
  showPoints: boolean;
  pointsOpacity: number;
  exaggeration: number;
}

export const defaultRenderSettings: RenderSettings = {
  mode: "contour-bw",
  interval: 0.2,
  sharpness: 2.5,
  showPlan: true,
  planOpacity: 0.5,
  showContours: true,
  contourOpacity: 1,
  showLabels: true,
  showPoints: true,
  pointsOpacity: 1,
  exaggeration: 1,
};

