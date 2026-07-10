import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, X, GripVertical, Database, Minus, Plus } from "lucide-react";
import type { SurveyPoint } from "@/lib/types";

interface Props {
  projectId: string;
  points: SurveyPoint[];
  selectedIds: Set<string>;
  onSelect: (id: string, additive?: boolean) => void;
  pointSize: number;
  onPointSizeChange: (n: number) => void;
}


interface PanelState {
  x: number;
  y: number;
  collapsed: boolean;
  hidden: boolean;
  expanded: boolean;
}

function loadState(projectId: string): PanelState {
  try {
    const raw = localStorage.getItem(`dpp:${projectId}`);
    if (raw) return { collapsed: false, hidden: false, expanded: false, x: 8, y: 52, ...JSON.parse(raw) };
  } catch {}
  return { x: 8, y: 52, collapsed: false, hidden: false, expanded: false };
}


export function DataPointsPanel({ projectId, points, selectedIds, onSelect, pointSize, onPointSizeChange }: Props) {
  const [state, setState] = useState<PanelState>(() => loadState(projectId));
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    setState(loadState(projectId));
  }, [projectId]);

  useEffect(() => {
    try { localStorage.setItem(`dpp:${projectId}`, JSON.stringify(state)); } catch {}
  }, [state, projectId]);

  // Auto-scroll selected row into view
  useEffect(() => {
    const firstId = selectedIds.values().next().value;
    if (!firstId) return;
    const el = rowRefs.current.get(firstId);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIds]);

  function onHeaderDown(e: ReactPointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { ox: e.clientX, oy: e.clientY, sx: state.x, sy: state.y };
  }
  function onHeaderMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.ox;
    const dy = e.clientY - d.oy;
    const maxX = Math.max(0, window.innerWidth - 220);
    const maxY = Math.max(0, window.innerHeight - 60);
    const nx = Math.max(0, Math.min(maxX, d.sx + dx));
    const ny = Math.max(0, Math.min(maxY, d.sy + dy));
    setState((s) => ({ ...s, x: nx, y: ny }));
  }
  function onHeaderUp() { dragRef.current = null; }

  if (state.hidden) {
    return (
      <button
        onClick={() => setState((s) => ({ ...s, hidden: false }))}
        className="fixed top-11 left-2 z-40 rounded-full bg-background/90 backdrop-blur border shadow-md h-8 px-2.5 flex items-center gap-1.5 text-xs font-medium"
      >
        <Database className="h-3.5 w-3.5" /> {points.length}
      </button>
    );
  }

  const width = 200;

  return (
    <div
      className="fixed z-40 bg-background border rounded-lg shadow-xl flex flex-col"
      style={{
        left: state.x,
        top: state.y,
        width,
        maxHeight: state.collapsed ? undefined : "45dvh",
      }}
    >
      <div
        className="flex items-center gap-1 border-b px-2 py-1.5 cursor-move select-none touch-none"
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        onPointerCancel={onHeaderUp}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold flex-1">Data points · {points.length}</span>
        <button
          className="p-1 hover:bg-muted rounded"
          onClick={() => setState((s) => ({ ...s, collapsed: !s.collapsed }))}
          aria-label={state.collapsed ? "Expand" : "Collapse"}
        >
          {state.collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        <button
          className="p-1 hover:bg-muted rounded"
          onClick={() => setState((s) => ({ ...s, hidden: true }))}
          aria-label="Hide"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {!state.collapsed && (
        <>
          <div className="flex items-center gap-1.5 px-2 py-1 border-b bg-muted/20">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Dot</span>
            <button
              className="ml-auto h-6 w-6 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40"
              onClick={() => onPointSizeChange(Math.max(1, pointSize - 1))}
              disabled={pointSize <= 1}
              aria-label="Smaller dot"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono w-8 text-center tabular-nums">{pointSize}px</span>
            <button
              className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40"
              onClick={() => onPointSizeChange(Math.min(8, pointSize + 1))}
              disabled={pointSize >= 8}
              aria-label="Larger dot"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
            <span className="w-8">#</span>
            <span className="flex-1">Value</span>
            <button
              className="text-[10px] normal-case hover:text-foreground"
              onClick={() => setState((s) => ({ ...s, expanded: !s.expanded }))}
            >
              {state.expanded ? "Less" : "More"}
            </button>
          </div>

          <div className="overflow-auto flex-1">
            {points.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground text-center">No points yet</div>
            ) : (
              points.map((p) => {
                const sel = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(p.id, el);
                      else rowRefs.current.delete(p.id);
                    }}
                    onClick={(e) => onSelect(p.id, e.shiftKey || e.metaKey)}
                    className={
                      "w-full text-left px-2 py-1.5 text-xs border-b border-border/50 flex items-start gap-1 " +
                      (sel ? "bg-primary/10 text-foreground" : "hover:bg-muted/50")
                    }
                  >
                    <span className="w-8 font-mono text-muted-foreground shrink-0">{p.index}</span>
                    <span className="flex-1 min-w-0">
                      <div className="font-mono tabular-nums">
                        {p.value.toFixed(2)}
                        {p.isBasePoint && (
                          <span className="ml-1.5 text-[9px] uppercase text-green-700">{p.label ?? "BP"}</span>
                        )}
                      </div>
                      {state.expanded && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          x:{p.x.toFixed(0)} y:{p.y.toFixed(0)}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </div>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
