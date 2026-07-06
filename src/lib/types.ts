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
  notes?: string;
  createdAt: number;
  // Topo presentation: user-nudged label offset from the dot.
  // undefined = use default offset (+8, +6).
  labelDx?: number;
  labelDy?: number;
}

export interface RenderSettings {
  mode: "contour-fill" | "contour-cells" | "contour-bw" | "points-only";
  interval: number; // legacy alias for contourStep
  firstContour: number | null;
  contourStep: number;
  contourCount: number | null; // null = auto (cover full data range at contourStep)
  minClamp: number | null;
  maxClamp: number | null;
  decimalPlaces: number;
  palette: "brown" | "rainbow" | "blue-red" | "gray";
  reversePalette: boolean;
  lineThickness: number;
  showPlan: boolean;
  planOpacity: number;
  showContours: boolean;
  contourOpacity: number;
  showLabels: boolean;
  showPoints: boolean;
  pointsOpacity: number;
  pointLabelBackground: "white" | "transparent";
  showLegend: boolean;
  legendX: number;
  legendY: number;
  showHighLow: boolean;
  exaggeration: number;
}

export const defaultRenderSettings: RenderSettings = {
  mode: "contour-fill",
  interval: 0.2,
  firstContour: null,
  contourStep: 0.2,
  contourCount: null,
  minClamp: null,
  maxClamp: null,
  decimalPlaces: 2,
  palette: "brown",
  reversePalette: false,
  lineThickness: 1.2,
  showPlan: true,
  planOpacity: 0.62,
  showContours: true,
  contourOpacity: 1,
  showLabels: true,
  showPoints: true,
  pointsOpacity: 1,
  pointLabelBackground: "white",
  showLegend: true,
  legendX: 24,
  legendY: 24,
  showHighLow: true,
  exaggeration: 1,
};
