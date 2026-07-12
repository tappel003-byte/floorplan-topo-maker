import type { Transition } from "@/lib/types";

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

interface Segment {
  name: string;
  soft: boolean;
  readings: number[];
}

function buildChain(activeId: string, transitions: readonly Transition[]): Segment[] {
  const active = transitions.find((t) => t.id === activeId);
  if (!active) return [];

  // Walk parentId → root so the diagram stacks every surface in the chain.
  // Root's surfaceA is the datum (tile in typical use); each subsequent hop
  // contributes only its surfaceB (its surfaceA equals the prior surfaceB).
  const path: Transition[] = [];
  const seen = new Set<string>();
  let cur: Transition | undefined = active;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? transitions.find((t) => t.id === cur!.parentId) : undefined;
  }

  const root = path[0];
  const segments: Segment[] = [
    { name: root.surfaceA, soft: SOFT_SURFACES.has(root.surfaceA), readings: [root.readingA] },
    { name: root.surfaceB, soft: SOFT_SURFACES.has(root.surfaceB), readings: [root.readingB] },
  ];
  for (let i = 1; i < path.length; i++) {
    const t = path[i];
    segments.push({ name: t.surfaceB, soft: SOFT_SURFACES.has(t.surfaceB), readings: [t.readingB] });
  }
  return segments;
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
  const chain = buildChain(activeId, transitions);
  if (chain.length === 0) return null;

  const SEG_W = 84;
  const PAD_X = 12;
  const TILE_Y = 40;      // dashed tile datum
  const SLAB_Y = 72;      // solid slab line
  const PIX_PER_INCH = 30; // vertical scale for elevation deltas
  const width = PAD_X * 2 + chain.length * SEG_W;
  const height = SLAB_Y + 26;

  // Datum = tile (or first) segment's first reading.
  // Higher reading = more distance from laser = LOWER floor (drawn further down).
  const datumSeg = chain.find((s) => s.name === "Tile") ?? chain[0];
  const datum = datumSeg.readings[0];

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

        {chain.map((seg, i) => {
          const x = PAD_X + i * SEG_W;
          const cx = x + SEG_W / 2;
          const isTile = seg.name === "Tile";
          const n = seg.readings.length;

          const drawX = (rx: number, y: number, reading: number, labelAbove: boolean) => (
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

          const readingX = (k: number) => {
            const t = n === 1 ? 0.5 : 0.22 + (0.56 * k) / (n - 1);
            return x + SEG_W * t;
          };

          if (isTile) {
            // Tile IS the dashed line — no block, X sits on dashed line.
            return (
              <g key={i}>
                <text x={cx} y={TILE_Y - 14} textAnchor="middle" fontSize={11} fontWeight={600} fill="#4b3820">
                  Tile
                </text>
                {seg.readings.map((r, k) => (
                  <g key={k}>{drawX(readingX(k), TILE_Y, r, false)}</g>
                ))}
              </g>
            );
          }

          if (seg.soft) {
            // Carpet: label + X on the slab.
            return (
              <g key={i}>
                <text x={cx} y={SLAB_Y - 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="#4b3820">
                  {seg.name}
                </text>
                {seg.readings.map((r, k) => (
                  <g key={k}>{drawX(readingX(k), SLAB_Y, r, false)}</g>
                ))}
              </g>
            );
          }

          // Other hard surface (wood etc.): block on slab, X on top.
          const blockH = HARD_THICKNESS[seg.name] ?? 18;
          const topY = SLAB_Y - blockH;
          return (
            <g key={i}>
              <rect x={x + 2} y={topY} width={SEG_W - 4} height={blockH} fill={HARD_FILL} stroke={HARD_STROKE} strokeWidth={1} rx={2} />
              <text x={cx} y={topY + blockH / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#ffffff">
                {seg.name}
              </text>
              {seg.readings.map((r, k) => (
                <g key={k}>{drawX(readingX(k), topY, r, true)}</g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
