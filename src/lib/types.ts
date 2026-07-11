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
  // Topo presentation: user-nudged offsets for the High/Low pins.
  // undefined = default position centered above the point.
  highPinDx?: number;
  highPinDy?: number;
  lowPinDx?: number;
  lowPinDy?: number;
  // Room notes — orange pins visible only on the field/data entry screen.
  notes?: NotePin[];
  // Flooring transitions — per-doorway anchor records. Each transition creates
  // one anchor SurveyPoint (isTransitionAnchor + transitionId) at (x, y) and
  // may be referenced by downstream points (transitionId set, not anchor).
  transitions?: Transition[];
}

export interface NotePin {
  id: string;
  x: number; // image coords
  y: number;
  text: string;
}

export interface Transition {
  id: string;
  x: number; // image coords of the anchor
  y: number;
  surfaceA: string; // reference side (anchor is captured here)
  surfaceB: string; // other side (downstream points live here)
  readingA: number; // e.g. 9.0 on tile
  readingB: number; // e.g. 8.6 on carpet
  createdAt: number;
}


export interface SurveyPoint {
  id: string;
  floorId: string;
  index: number; // display number, 1..n
  x: number; // image coords
  y: number;
  value: number; // raw elevation reading in inches (BP default 9.0)
  isBasePoint?: boolean;
  label?: string; // BP1, BP2, etc.
  notes?: string;
  createdAt: number;
  // Topo presentation: user-nudged label offset from the dot.
  // undefined = use default offset (+8, +6).
  labelDx?: number;
  labelDy?: number;
  // Transition tagging.
  // - Anchor point: isTransitionAnchor = true AND transitionId set. `value`
  //   stores readingA (reference side); no offset applied.
  // - Downstream point on the "other" surface: transitionId set (no anchor
  //   flag). `value` is the raw reading; corrected value = value + delta,
  //   where delta = readingA − readingB.
  transitionId?: string;
  isTransitionAnchor?: boolean;
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
  pointLabelFontSize: number;
  pointLabelColor: string;
  pointLabelWeight: "normal" | "bold";
  showLegend: boolean;
  legendX: number;
  legendY: number;
  legendScale: number;
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
  pointLabelFontSize: 11,
  pointLabelColor: "#17130e",
  pointLabelWeight: "bold",
  showLegend: true,
  legendX: 24,
  legendY: 24,
  legendScale: 1,
  showHighLow: true,
  exaggeration: 1,
};
