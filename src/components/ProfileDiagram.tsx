import type { Transition } from "@/lib/types";

interface Props {
  activeId: string;
  transitions: readonly Transition[];
}

/** One surface strip in the stacked profile. */
interface Surface {
  name: string;
  raw: number; // manometer reading as taken at that doorway
  delta: number; // signed offset from base (readingA) frame
  probedToSlab: boolean; // true = manometer tip went through to slab (label at slab)
}

/**
 * Compact profile of the active flooring chain, drawn to match what the
 * manometer actually measures:
 *
 *   - Dashed slab line = shared datum for all readings.
 *   - Each surface = a block sitting on the slab (thicker = softer/taller).
 *   - Raw reading label sits WHERE THE PROBE TOUCHED:
 *       * anchor (root, hard surface like tile) → top of block
 *       * soft surface (delta > 0, probed through) → at the slab line
 *       * hard downstream surface → top of block
 *   - Delta chip shows the correction added to reach base-frame.
 *
 * Meant to render inside the NumericKeypad — the diagram only exists while
 * the user is actively logging a point in the chain.
 */
export function ProfileDiagram({ activeId, transitions }: Props) {
  // Walk parentId chain up to the root.
  const chain: Transition[] = [];
  {
    const byId = new Map(transitions.map((t) => [t.id, t]));
    let cur = byId.get(activeId);
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      chain.unshift(cur);
      guard.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }
  if (chain.length === 0) return null;

  const root = chain[0];
  // Build ordered surface list. Anchor = surfaceA of root (measured on top).
  // Every next surface B in the chain: raw reading, delta from base.
  const surfaces: Surface[] = [
    { name: root.surfaceA, raw: root.readingA, delta: 0, probedToSlab: false },
  ];
  for (const t of chain) {
    const delta = t.readingA - t.readingB; // add to raw to get base-frame
    surfaces.push({
      name: t.surfaceB,
      raw: t.readingB,
      delta,
      // Heuristic: positive delta means raw < ref → probed through soft cover.
      probedToSlab: delta > 0.05,
    });
  }

  // Visual "thickness" per surface — pure decoration to communicate soft vs hard.
  const THICKNESS: Record<string, number> = {
    Tile: 14,
    Hardwood: 22,
    Wood: 22,
    LVP: 12,
    Vinyl: 10,
    Laminate: 16,
    Stone: 16,
    Concrete: 4,
    Carpet: 40,
    Other: 20,
  };

  const BLOCK_W = 66;
  const GAP = 6;
  const PAD_X = 10;
  const SLAB_Y = 78; // dashed slab line — reserve room above for tall blocks + labels
  const width = PAD_X * 2 + surfaces.length * BLOCK_W + (surfaces.length - 1) * GAP;
  const height = SLAB_Y + 26; // room below slab for probed-through reading

  const PALETTE = ["#c4a484", "#a67c52", "#8b6f47", "#6b5537", "#4a3c26"];

  return (
    <div className="rounded-md border border-gray-200 bg-white/95 px-1 py-1 overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* Dashed slab reference line */}
        <line
          x1={PAD_X - 4}
          x2={width - PAD_X + 4}
          y1={SLAB_Y}
          y2={SLAB_Y}
          stroke="#6b7280"
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
        <text
          x={width - PAD_X + 4}
          y={SLAB_Y + 12}
          textAnchor="end"
          fontSize={9}
          fill="#6b7280"
          fontFamily="ui-monospace, monospace"
        >
          slab
        </text>

        {surfaces.map((s, i) => {
          const x = PAD_X + i * (BLOCK_W + GAP);
          const blockH = THICKNESS[s.name] ?? 20;
          const topY = SLAB_Y - blockH;
          const color = PALETTE[i % PALETTE.length];
          const labelY = s.probedToSlab ? SLAB_Y + 12 : topY - 5;
          const tickY1 = s.probedToSlab ? SLAB_Y : topY;
          const tickY2 = s.probedToSlab ? SLAB_Y + 3 : topY - 3;

          return (
            <g key={i}>
              {/* Block */}
              <rect
                x={x}
                y={topY}
                width={BLOCK_W}
                height={blockH}
                fill={color}
                stroke="#4b3820"
                strokeWidth={1}
                rx={2}
              />
              {/* Surface name inside block */}
              <text
                x={x + BLOCK_W / 2}
                y={topY + blockH / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="#ffffff"
              >
                {s.name}
              </text>
              {/* Tick showing where probe touched */}
              <line
                x1={x + BLOCK_W / 2}
                x2={x + BLOCK_W / 2}
                y1={tickY1}
                y2={tickY2}
                stroke="#111827"
                strokeWidth={1.25}
              />
              {/* Raw reading */}
              <text
                x={x + BLOCK_W / 2}
                y={labelY}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="#111827"
                fontFamily="ui-monospace, monospace"
              >
                {s.raw.toFixed(1)}
              </text>
              {/* Delta chip — skip for anchor */}
              {i > 0 && Math.abs(s.delta) > 0.001 && (
                <text
                  x={x + BLOCK_W / 2}
                  y={s.probedToSlab ? SLAB_Y + 22 : topY - 16}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill={s.delta >= 0 ? "#15803d" : "#b91c1c"}
                  fontFamily="ui-monospace, monospace"
                >
                  {s.delta >= 0 ? "+" : "−"}
                  {Math.abs(s.delta).toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
