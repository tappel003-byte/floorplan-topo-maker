import { X } from "lucide-react";
import type { Transition } from "@/lib/types";

interface Props {
  activeId: string;
  transitions: readonly Transition[];
  onDismiss?: () => void;
}

/** One surface strip in the stacked profile. */
interface Surface {
  name: string;
  raw: number; // manometer reading on this surface at its doorway
  corrected: number; // base-frame equivalent (== slab datum)
}

/**
 * Renders the active flooring chain as a small profile diagram:
 * a dashed slab reference line with a colored block per surface, each
 * labeled with its raw reading, and non-reference blocks tagged with
 * their offset (+0.4, −1.0, etc.).
 *
 * The diagram IS the state — no extra chip needed.
 */
export function ProfileDiagram({ activeId, transitions, onDismiss }: Props) {
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

  // Build ordered surface list: root.A, root.B, next.B, next.B, …
  const root = chain[0];
  const surfaces: Surface[] = [
    { name: root.surfaceA, raw: root.readingA, corrected: root.readingA },
  ];
  for (const t of chain) {
    surfaces.push({ name: t.surfaceB, raw: t.readingB, corrected: t.readingA });
  }

  // Reference (slab) = root readingA — everything is normalized to this.
  const reference = root.readingA;

  // Vertical scale — pixels per inch of delta from reference.
  // Cap so a very deep chain doesn't explode the card.
  const deltas = surfaces.map((s) => Math.abs(s.corrected - s.raw));
  const maxDelta = Math.max(0.4, ...deltas);
  const PX_PER_INCH = Math.min(50, 70 / maxDelta);

  // Layout constants
  const BLOCK_W = 74;
  const GAP = 8;
  const PAD_X = 14;
  const REF_Y = 30; // y of the dashed slab line
  const BLOCK_BASE = 108; // y of the bottom of every block
  const width = PAD_X * 2 + surfaces.length * BLOCK_W + (surfaces.length - 1) * GAP;
  const height = BLOCK_BASE + 22; // space for bottom surface label

  // Assign block colors per surface index (stable palette).
  const PALETTE = ["#c4a484", "#a67c52", "#8b6f47", "#6b5537", "#4a3c26"];

  return (
    <div className="pointer-events-auto rounded-xl bg-white/95 backdrop-blur shadow-lg border border-gray-200 px-2 py-2">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Chain
        </span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss chain"
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* Dashed slab reference line, running across all blocks */}
        <line
          x1={PAD_X - 4}
          x2={width - PAD_X + 4}
          y1={REF_Y}
          y2={REF_Y}
          stroke="#6b7280"
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
        <text
          x={width - PAD_X + 4}
          y={REF_Y - 4}
          textAnchor="end"
          fontSize={9}
          fill="#6b7280"
          fontFamily="ui-monospace, monospace"
        >
          slab
        </text>

        {surfaces.map((s, i) => {
          const x = PAD_X + i * (BLOCK_W + GAP);
          // Delta = corrected - raw. Positive = raw was lower than slab.
          const delta = s.corrected - s.raw;
          // Block top: shift downward from REF_Y proportional to delta.
          // If delta = 0, top sits at REF_Y (flush with slab line).
          const topY = REF_Y + delta * PX_PER_INCH;
          const blockH = Math.max(28, BLOCK_BASE - topY);
          const color = PALETTE[i % PALETTE.length];
          const isRef = i === 0;
          return (
            <g key={i}>
              {/* Raw reading label above the block top */}
              <text
                x={x + BLOCK_W / 2}
                y={topY - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="#111827"
                fontFamily="ui-monospace, monospace"
              >
                {s.raw.toFixed(1)}
              </text>
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
                y={topY + Math.min(blockH / 2 + 4, blockH - 6)}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="#ffffff"
              >
                {s.name}
              </text>
              {/* Delta chip — skip for reference (delta = 0). Positioned in
                  the gap between the raw label and the slab line. */}
              {!isRef && Math.abs(delta) > 0.001 && (
                <text
                  x={x + BLOCK_W / 2}
                  y={REF_Y - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill={delta >= 0 ? "#15803d" : "#b91c1c"}
                  fontFamily="ui-monospace, monospace"
                >
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta).toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
