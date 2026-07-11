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

interface Surface {
  name: string;
  reading: number;
  readingFar?: number;
  soft: boolean;
}

/**
 * Compact profile of the active doorway transition. Rebuilt to match how the
 * manometer actually measures:
 *
 *   - Dashed slab line = shared datum.
 *   - Hard surfaces (tile / wood / etc) = colored block sitting ON the slab,
 *     with the reading labeled on top and a probe tick at the top of the block.
 *   - Soft surfaces (carpet) = thin strip flush WITH the slab (no block above),
 *     because the probe goes through the carpet to the slab. Readings sit at
 *     the slab line. Soft surfaces can have TWO readings (near-door and
 *     far-side of the room) — both are shown as separate ticks/labels.
 *
 * Only shows the single active transition — no parent-chain walking.
 */
export function ProfileDiagram({ activeId, transitions }: Props) {
  const t = transitions.find((x) => x.id === activeId);
  if (!t) return null;

  const surfaces: Surface[] = [
    {
      name: t.surfaceA,
      reading: t.readingA,
      readingFar: t.readingAFar,
      soft: SOFT_SURFACES.has(t.surfaceA),
    },
    {
      name: t.surfaceB,
      reading: t.readingB,
      readingFar: t.readingBFar,
      soft: SOFT_SURFACES.has(t.surfaceB),
    },
  ];

  const BLOCK_W = 74;
  const GAP = 6;
  const PAD_X = 10;
  const SLAB_Y = 60;
  const width = PAD_X * 2 + surfaces.length * BLOCK_W + (surfaces.length - 1) * GAP;
  const height = SLAB_Y + 30;

  const PALETTE = ["#c4a484", "#8b6f47"];
  const SOFT_COLOR = "#b89968";

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
          y={SLAB_Y + 20}
          textAnchor="end"
          fontSize={9}
          fill="#6b7280"
          fontFamily="ui-monospace, monospace"
        >
          slab
        </text>

        {surfaces.map((s, i) => {
          const x = PAD_X + i * (BLOCK_W + GAP);
          const color = s.soft ? SOFT_COLOR : PALETTE[i % PALETTE.length];

          if (s.soft) {
            // Thin strip flush with slab. Readings live AT the slab.
            const STRIP_H = 5;
            const stripY = SLAB_Y - STRIP_H;
            const leftReading = s.reading;
            const rightReading = s.readingFar;
            const showTwo = typeof rightReading === "number";
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={stripY}
                  width={BLOCK_W}
                  height={STRIP_H}
                  fill={color}
                  stroke="#4b3820"
                  strokeWidth={0.75}
                  rx={1}
                />
                {/* Surface name — small, sits just above the strip */}
                <text
                  x={x + BLOCK_W / 2}
                  y={stripY - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="#4b3820"
                >
                  {s.name}
                </text>
                {/* Reading labels AT slab. One centered, or two split left/right. */}
                {showTwo ? (
                  <>
                    <line
                      x1={x + 8}
                      x2={x + 8}
                      y1={SLAB_Y}
                      y2={SLAB_Y + 4}
                      stroke="#111827"
                      strokeWidth={1.25}
                    />
                    <text
                      x={x + 8}
                      y={SLAB_Y + 14}
                      textAnchor="start"
                      fontSize={11}
                      fontWeight={700}
                      fill="#111827"
                      fontFamily="ui-monospace, monospace"
                    >
                      {leftReading.toFixed(1)}
                    </text>
                    <line
                      x1={x + BLOCK_W - 8}
                      x2={x + BLOCK_W - 8}
                      y1={SLAB_Y}
                      y2={SLAB_Y + 4}
                      stroke="#111827"
                      strokeWidth={1.25}
                    />
                    <text
                      x={x + BLOCK_W - 8}
                      y={SLAB_Y + 14}
                      textAnchor="end"
                      fontSize={11}
                      fontWeight={700}
                      fill="#111827"
                      fontFamily="ui-monospace, monospace"
                    >
                      {rightReading!.toFixed(1)}
                    </text>
                  </>
                ) : (
                  <>
                    <line
                      x1={x + BLOCK_W / 2}
                      x2={x + BLOCK_W / 2}
                      y1={SLAB_Y}
                      y2={SLAB_Y + 4}
                      stroke="#111827"
                      strokeWidth={1.25}
                    />
                    <text
                      x={x + BLOCK_W / 2}
                      y={SLAB_Y + 14}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill="#111827"
                      fontFamily="ui-monospace, monospace"
                    >
                      {leftReading.toFixed(1)}
                    </text>
                  </>
                )}
              </g>
            );
          }

          // Hard surface: block above slab, reading on top.
          const blockH = HARD_THICKNESS[s.name] ?? 18;
          const topY = SLAB_Y - blockH;
          return (
            <g key={i}>
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
              {/* Probe tick at top of block */}
              <line
                x1={x + BLOCK_W / 2}
                x2={x + BLOCK_W / 2}
                y1={topY}
                y2={topY - 3}
                stroke="#111827"
                strokeWidth={1.25}
              />
              <text
                x={x + BLOCK_W / 2}
                y={topY - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="#111827"
                fontFamily="ui-monospace, monospace"
              >
                {s.reading.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
