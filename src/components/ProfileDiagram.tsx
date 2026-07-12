import type { Transition } from "@/lib/types";

interface Props {
  activeId: string;
  transitions: readonly Transition[];
}

/** Soft surfaces are probed through — reading is taken AT the slab. */
const SOFT_SURFACES = new Set(["Carpet", "Pad", "Rug"]);

/** Visual "block" heights for hard surfaces (purely decorative). */
const HARD_THICKNESS: Record<string, number> = {
  Tile: 16,
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
  /** Readings taken on this surface — one entry per doorway that touches it. */
  readings: number[];
}

/**
 * Merge a sequence of transitions into one left-to-right profile.
 *
 * Rules:
 *  - Transitions are processed in createdAt order.
 *  - The FIRST transition seeds [A, B].
 *  - Each subsequent transition must share ONE surface with the current tail
 *    of the chain — that shared surface accumulates the second reading
 *    (both doorways touching it get an X on the slab), and the non-shared
 *    surface is appended as the new tail.
 *  - Any transition that doesn't connect to the tail is skipped (kept simple —
 *    each floor has one active chain).
 */
function buildChain(transitions: readonly Transition[]): Segment[] {
  const sorted = [...transitions].sort((a, b) => a.createdAt - b.createdAt);
  if (sorted.length === 0) return [];

  const first = sorted[0];
  const segments: Segment[] = [
    {
      name: first.surfaceA,
      soft: SOFT_SURFACES.has(first.surfaceA),
      readings: [first.readingA],
    },
    {
      name: first.surfaceB,
      soft: SOFT_SURFACES.has(first.surfaceB),
      readings: [first.readingB],
    },
  ];

  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i];
    const tail = segments[segments.length - 1];
    if (t.surfaceA === tail.name) {
      tail.readings.push(t.readingA);
      segments.push({
        name: t.surfaceB,
        soft: SOFT_SURFACES.has(t.surfaceB),
        readings: [t.readingB],
      });
    } else if (t.surfaceB === tail.name) {
      tail.readings.push(t.readingB);
      segments.push({
        name: t.surfaceA,
        soft: SOFT_SURFACES.has(t.surfaceA),
        readings: [t.readingA],
      });
    }
    // else: doesn't attach to tail — skip
  }

  return segments;
}

/**
 * Field profile of the doorway chain. Matches how the manometer measures:
 *
 *   - Dashed slab line = shared datum, spans the entire chain.
 *   - Hard surfaces (tile, wood, etc.) = colored block sitting ON the slab
 *     with an X + reading on top of the block.
 *   - Soft surfaces (carpet) = label only, NO block (probe reads slab through
 *     carpet). Each doorway that touches this carpet contributes one X on
 *     the slab with the reading below it.
 *
 * The chain grows left-to-right as transitions are added.
 */
export function ProfileDiagram({ activeId, transitions }: Props) {
  const chain = buildChain(transitions);
  if (chain.length === 0) return null;

  const SEG_W = 84;
  const GAP = 0; // segments share the slab; no visual gap
  const PAD_X = 12;
  const SLAB_Y = 62;
  const width = PAD_X * 2 + chain.length * SEG_W + Math.max(0, chain.length - 1) * GAP;
  const height = SLAB_Y + 34;

  const HARD_FILL = "#c4a484";
  const HARD_STROKE = "#4b3820";

  return (
    <div className="rounded-md border border-gray-200 bg-white/95 px-1 py-1 overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* Dashed slab reference line — spans full chain */}
        <line
          x1={PAD_X - 6}
          x2={width - PAD_X + 6}
          y1={SLAB_Y}
          y2={SLAB_Y}
          stroke="#6b7280"
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
        <text
          x={width - PAD_X + 4}
          y={SLAB_Y + 22}
          textAnchor="end"
          fontSize={9}
          fill="#6b7280"
          fontFamily="ui-monospace, monospace"
        >
          slab
        </text>

        {chain.map((seg, i) => {
          const x = PAD_X + i * (SEG_W + GAP);
          const cx = x + SEG_W / 2;

          if (seg.soft) {
            // Carpet: label only, no block. Readings live on the slab, one X
            // per doorway that touches this segment.
            const n = seg.readings.length;
            return (
              <g key={i}>
                {/* Surface label floats above the slab */}
                <text
                  x={cx}
                  y={SLAB_Y - 18}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="#4b3820"
                >
                  {seg.name}
                </text>
                {seg.readings.map((r, k) => {
                  // Distribute Xs evenly across the segment width.
                  const t = n === 1 ? 0.5 : 0.18 + (0.64 * k) / (n - 1);
                  const rx = x + SEG_W * t;
                  return (
                    <g key={k}>
                      {/* X mark on the slab */}
                      <line
                        x1={rx - 4}
                        x2={rx + 4}
                        y1={SLAB_Y - 4}
                        y2={SLAB_Y + 4}
                        stroke="#111827"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={rx - 4}
                        x2={rx + 4}
                        y1={SLAB_Y + 4}
                        y2={SLAB_Y - 4}
                        stroke="#111827"
                        strokeWidth={1.5}
                      />
                      <text
                        x={rx}
                        y={SLAB_Y + 18}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={700}
                        fill="#111827"
                        fontFamily="ui-monospace, monospace"
                      >
                        {r.toFixed(1)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          }

          // Hard surface: block on slab, X + reading on top.
          const blockH = HARD_THICKNESS[seg.name] ?? 18;
          const topY = SLAB_Y - blockH;
          const n = seg.readings.length;
          return (
            <g key={i}>
              <rect
                x={x + 2}
                y={topY}
                width={SEG_W - 4}
                height={blockH}
                fill={HARD_FILL}
                stroke={HARD_STROKE}
                strokeWidth={1}
                rx={2}
              />
              <text
                x={cx}
                y={topY + blockH / 2 + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="#ffffff"
              >
                {seg.name}
              </text>
              {seg.readings.map((r, k) => {
                const t = n === 1 ? 0.5 : 0.22 + (0.56 * k) / (n - 1);
                const rx = x + SEG_W * t;
                return (
                  <g key={k}>
                    {/* X mark on top of the block */}
                    <line
                      x1={rx - 4}
                      x2={rx + 4}
                      y1={topY - 4}
                      y2={topY + 4}
                      stroke="#111827"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={rx - 4}
                      x2={rx + 4}
                      y1={topY + 4}
                      y2={topY - 4}
                      stroke="#111827"
                      strokeWidth={1.5}
                    />
                    <text
                      x={rx}
                      y={topY - 8}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill="#111827"
                      fontFamily="ui-monospace, monospace"
                    >
                      {r.toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
