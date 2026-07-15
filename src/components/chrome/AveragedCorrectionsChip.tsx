import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import type { Floor } from "@/lib/types";
import { formatDelta, transitionGroupKey } from "@/lib/transitions";

interface Props {
  floor: Floor;
  storageKey: string; // per-tab expanded persistence
  onManage: () => void;
}

/**
 * Locked status chip (bottom-right) surfacing that averaged flooring
 * corrections are currently applied. Hidden when no group averages exist.
 * Collapsed = pill; tap to expand in place into a compact table.
 */
export function AveragedCorrectionsChip({ floor, storageKey, onManage }: Props) {
  const averages = floor.transitionGroupAverages ?? {};
  const entries = Object.entries(averages);

  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`${storageKey}:expanded`) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}:expanded`, expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded, storageKey]);

  if (entries.length === 0) return null;

  // Look up display surfaces from the floor transitions since key is `${A}→${B}`.
  const surfaceForKey = new Map<string, { a: string; b: string }>();
  for (const t of floor.transitions ?? []) {
    surfaceForKey.set(transitionGroupKey(t), { a: t.surfaceA, b: t.surfaceB });
  }

  return (
    <div
      className="fixed z-40 select-none bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-[calc(env(safe-area-inset-right)+0.75rem)]"
    >

      {!expanded ? (
        <button
          type="button"
          onClick={() => {
            if (!moved.current) setExpanded(true);
          }}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-amber-400/70 bg-amber-100/95 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 text-[11px] font-medium shadow-sm hover:bg-amber-200/90"
          aria-label="Averaged corrections used"
        >
          <Flag className="h-3 w-3" />
          <span>Averaged corrections used</span>
          <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-amber-500/90 text-white text-[10px] font-semibold">
            {entries.length}
          </span>
        </button>
      ) : (
        <div
          className="rounded-md border border-amber-400/70 bg-amber-50/95 dark:bg-amber-950/70 shadow-lg min-w-[13rem] max-w-[16rem]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-2.5 h-7 border-b border-amber-300/60">
            <div className="inline-flex items-center gap-1.5 text-amber-900 dark:text-amber-100 text-[11px] font-semibold">
              <Flag className="h-3 w-3" />
              Averaged corrections
            </div>
            <button
              type="button"
              onClick={() => {
                if (!moved.current) setExpanded(false);
              }}
              className="text-[10px] text-amber-900/70 dark:text-amber-100/70 hover:text-amber-900 dark:hover:text-amber-100"
              aria-label="Collapse"
            >
              Hide
            </button>
          </div>
          <ul className="px-2.5 py-1.5 flex flex-col gap-0.5">
            {entries.map(([key, value]) => {
              const s = surfaceForKey.get(key);
              const label = s ? `${s.a} → ${s.b}` : key;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between text-[11px] text-amber-900 dark:text-amber-100 font-mono tabular-nums gap-3"
                >
                  <span className="font-sans truncate">{label}</span>
                  <span className="font-semibold">{formatDelta(value)}"</span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-amber-300/60 px-2.5 py-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (moved.current) return;
                onManage();
              }}
              className="text-[11px] font-medium text-amber-900 dark:text-amber-100 hover:underline"
            >
              Manage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
