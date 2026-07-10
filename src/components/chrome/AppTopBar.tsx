import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Undo2, Redo2 } from "lucide-react";
import { deleteProject, listPoints, deletePoint } from "@/lib/db";

type Props = {
  projectId: string;
  projectName: string;
  floorName: string;
  activeFloorId: string;
  onOpenSetup: () => void;
  onOpenReview: () => void;
  onOpenExport: () => void;
  onPointsCleared?: () => void;
};

/**
 * Shared top strip: back · title · Undo · Redo · ⋯
 * Undo/Redo dispatch window events so any active tool can subscribe
 * without a global store change.
 */
export function AppTopBar({
  projectId,
  projectName,
  floorName,
  activeFloorId,
  onOpenSetup,
  onOpenReview,
  onOpenExport,
  onPointsCleared,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("touchstart", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("touchstart", close);
    };
  }, [menuOpen]);

  const fire = (name: "app:undo" | "app:redo") =>
    window.dispatchEvent(new CustomEvent(name));

  const handleClearPoints = async () => {
    setMenuOpen(false);
    if (!confirm("Clear all points on this floor? This cannot be undone.")) return;
    const pts = await listPoints(activeFloorId);
    for (const p of pts) await deletePoint(p.id);
    onPointsCleared?.();
  };

  const handleDeleteProject = async () => {
    setMenuOpen(false);
    if (!confirm(`Delete project "${projectName}"? This cannot be undone.`)) return;
    await deleteProject(projectId);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur border-b">
      <div className="flex items-center gap-1 px-2 h-9 text-xs">
        <Link
          to="/"
          className="inline-flex items-center h-8 w-8 justify-center text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Back to projects"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0 truncate">
          <span className="font-medium">{projectName}</span>
          <span className="text-muted-foreground"> · {floorName}</span>
        </div>
        <button
          type="button"
          onClick={() => fire("app:undo")}
          className="inline-flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => fire("app:redo")}
          className="inline-flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="More"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 min-w-[10rem] rounded-md border bg-popover shadow-lg z-50 py-1 text-sm"
            >
              <MenuItem
                label="Review"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenReview();
                }}
              />
              <MenuItem
                label="Setup"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSetup();
                }}
              />
              <MenuItem
                label="Export"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenExport();
                }}
              />
              <div className="my-1 border-t" />
              <MenuItem label="Clear all points" onClick={handleClearPoints} destructive />
              <MenuItem label="Delete project" onClick={handleDeleteProject} destructive />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  label,
  onClick,
  destructive,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={
        "w-full text-left px-3 py-1.5 hover:bg-accent " +
        (destructive ? "text-destructive" : "")
      }
    >
      {label}
    </button>
  );
}
