import type { Transition } from "@/lib/types";
import { chainDelta } from "@/lib/transitions";

interface Props {
  activeId: string;
  transitions: readonly Transition[];
}

/** Soft surfaces are probed through — reading is taken AT the slab. */
const SOFT_SURFACES = new Set(["Carpet", "Pad", "Rug"]);

/** Visual "block" heights for hard surfaces above the slab (decorative). */
const HARD_THICKNESS: Record<string, number> = {
  Tile: 14,
  Hardwood: 22,
  Wood: 22,
  LVP: 14,
  Vinyl: 12,
  Laminate: 16,
  Stone: 18,
  Concrete: 6,
  Other: 18,
};

function buildPath(activeId: string, transitions: readonly Transition[]): Transition[] {
  const active = transitions.find((t) => t.id === activeId);
  if (!active) return [];

  const path: Transition[] = [];
  const seen = new Set<string>();
  let cur: Transition | undefined = active;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? transitions.find((t) => t.id === cur!.parentId) : undefined;
  }
  return path;
}

/**
 * Field profile of the doorway chain.
 *
 *   - Dashed line = TILE reference (datum).
 *   - Slab = solid line below the tile datum.
 *   - Tile segments: the dashed line IS the tile; X sits on the dashed line.
 *   - Soft surfaces (carpet) = label only, X sits on the slab (below dashed).
 *   - Other hard surfaces (wood, etc.) = block sitting on the slab with X + reading on top.
 */
export function ProfileDiagram({ activeId, transitions }: Props) {
  const path = buildPath(activeId, transitions);
  if (path.length === 0) return null;

  const root = path[0];

  const SEG_W = 84;
  const PAD_X = 12;
  const TILE_Y = 40;      // dashed tile datum
  const SLAB_Y = 72;      // solid slab line
  const PIX_PER_INCH = 30; // vertical scale for elevation deltas
  const width = PAD_X * 2 + (path.length + 1) * SEG_W;
  const height = SLAB_Y + 26;

  const datum = root.readingA;

  const HARD_FILL = "#c4a484";
  const HARD_STROKE = "#4b3820";

  return (
    <div className="rounded-md border border-gray-200 bg-white/95 px-1 py-1 overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        {/* Dashed TILE reference line — spans full chain */}
        <line
          x1={PAD_X - 6}
          x2={width - PAD_X + 6}
          y1={TILE_Y}
          y2={TILE_Y}
          stroke="#4b3820"
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
        <text x={width - PAD_X + 4} y={TILE_Y - 4} textAnchor="end" fontSize={9} fill="#4b3820" fontFamily="ui-monospace, monospace">
          tile
        </text>

        {/* Solid SLAB line */}
        <line x1={PAD_X - 6} x2={width - PAD_X + 6} y1={SLAB_Y} y2={SLAB_Y} stroke="#6b7280" strokeWidth={1.25} />
        <text x={width - PAD_X + 4} y={SLAB_Y + 14} textAnchor="end" fontSize={9} fill="#6b7280" fontFamily="ui-monospace, monospace">
          slab
        </text>

        {/* Root datum: the dashed line IS the tile/reference surface. */}
        <g>
          <text x={PAD_X + SEG_W / 2} y={TILE_Y - 14} textAnchor="middle" fontSize={11} fontWeight={600} fill="#4b3820">
            {root.surfaceA}
          </text>
          {drawX(PAD_X + SEG_W / 2, TILE_Y, root.readingA, false)}
        </g>

        {path.map((t, i) => {
          const segIndex = i + 1;
          const surfaceName = t.surfaceB;
          const soft = SOFT_SURFACES.has(surfaceName);
          const parentDelta = t.parentId ? chainDelta(t.parentId, transitions) : 0;
          const fromReading = i === 0 ? t.readingB : t.readingA + parentDelta;
          const x = PAD_X + segIndex * SEG_W;
          const cx = x + SEG_W / 2;

          // Hard finish top uses the actual B-side reading (wood is 9.5 in the example),
          // never the adjusted slab/carpet value (8.7 in the example).
          const hardTopDrop = Math.max(0, t.readingB - datum) * PIX_PER_INCH;
          const hardTopY = Math.min(SLAB_Y - 8, TILE_Y + hardTopDrop);

          if (soft) {
            return (
              <g key={t.id}>
                <text x={cx} y={SLAB_Y - 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="#4b3820">
                  {surfaceName}
                </text>
                {drawX(cx, SLAB_Y, fromReading, false)}
              </g>
            );
          }

          const blockH = Math.max(8, SLAB_Y - hardTopY);
          return (
            <g key={t.id}>
              <rect x={x + 2} y={hardTopY} width={SEG_W - 4} height={blockH} fill={HARD_FILL} stroke={HARD_STROKE} strokeWidth={1} rx={2} />
              <text x={cx} y={hardTopY + blockH / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#ffffff">
                {surfaceName}
              </text>
              {drawX(cx, hardTopY, t.readingB, true)}
              {i > 0 && (
                <g opacity={0.9}>
                  <text x={x + 5} y={SLAB_Y - 18} textAnchor="start" fontSize={9} fontWeight={600} fill="#6b7280">
                    {t.surfaceA}
                  </text>
                  {drawX(x + 14, SLAB_Y, fromReading, false)}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function drawX(rx: number, y: number, reading: number, labelAbove: boolean) {
  return (
    <g>
      <line x1={rx - 4} x2={rx + 4} y1={y - 4} y2={y + 4} stroke="#111827" strokeWidth={1.5} />
      <line x1={rx - 4} x2={rx + 4} y1={y + 4} y2={y - 4} stroke="#111827" strokeWidth={1.5} />
      <text
        x={rx}
        y={labelAbove ? y - 8 : y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#111827"
        fontFamily="ui-monospace, monospace"
      >
        {reading.toFixed(1)}
      </text>
    </g>
  );
}
