import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";

type Props = {
  projectName: string;
  floorName: string;
  onOpenSetup: () => void;
  onOpenReview: () => void;
  onOpenExport: () => void;
  onOpenTransitions?: () => void;
  onOpen3D?: () => void;
  undoEnabled?: boolean;
  redoEnabled?: boolean;
};

const PAPER = "#fffaf0";
const INK = "#1a1a1a";
const MUTED = "#7a7468";
const LINE = "#d9d2c2";
const BG = "#f4f0e8";

/**
 * Distress Survey work-head: paper strip, title stack, emoji icon-btns.
 * Undo/Redo dispatch window events so any active tool can subscribe
 * without a global store change.
 */
export function AppTopBar({
  projectName,
  floorName,
  onOpenSetup,
  onOpenReview,
  onOpenExport,
  onOpenTransitions,
  onOpen3D,
  undoEnabled = true,
  redoEnabled = true,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const fire = (name: "app:undo" | "app:redo") => window.dispatchEvent(new CustomEvent(name));

  const iconBtn: CSSProperties = {
    background: "transparent",
    border: "none",
    width: 38,
    height: 38,
    borderRadius: 8,
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: INK,
    flexShrink: 0,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  };

  return (
    <header
      className="sticky top-0 z-50 pt-[env(safe-area-inset-top)] landscape-short:pt-[max(env(safe-area-inset-top),1.5rem)] landscape-short:pl-[env(safe-area-inset-left)] landscape-short:pr-[env(safe-area-inset-right)]"
      style={{
        background: PAPER,
        borderBottom: `1px solid ${LINE}`,
        color: INK,
      }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 8,
          padding: "8px 10px",
          minHeight: 48,
          boxSizing: "border-box",
        }}
      >
        <Link
          to="/"
          aria-label="Back to Recents"
          title="Back to Recents"
          className="shrink-0 flex items-center justify-center active:bg-[#d9d2c2]"
          style={{
            background: "transparent",
            border: "none",
            width: 40,
            height: 40,
            borderRadius: 10,
            fontSize: 22,
            color: INK,
            textDecoration: "none",
            lineHeight: 1,
          }}
        >
          ←
        </Link>

        <div
          className="min-w-0"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.2,
          }}
        >
          <b
            style={{
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: INK,
            }}
          >
            {projectName}
          </b>
          <small
            style={{
              fontSize: 10,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {floorName}
          </small>
        </div>

        <button
          type="button"
          onClick={() => {
            setJustSaved(true);
            window.setTimeout(() => setJustSaved(false), 1500);
          }}
          style={iconBtn}
          aria-label="Save"
          title="Save"
        >
          {justSaved ? "✅" : "💾"}
        </button>
        <button
          type="button"
          onClick={() => undoEnabled && fire("app:undo")}
          disabled={!undoEnabled}
          style={{
            ...iconBtn,
            opacity: undoEnabled ? 1 : 0.3,
            cursor: undoEnabled ? "pointer" : "not-allowed",
          }}
          aria-label="Undo"
          title="Undo"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={() => redoEnabled && fire("app:redo")}
          disabled={!redoEnabled}
          style={{
            ...iconBtn,
            opacity: redoEnabled ? 1 : 0.3,
            cursor: redoEnabled ? "pointer" : "not-allowed",
          }}
          aria-label="Redo"
          title="Redo"
        >
          ↷
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={iconBtn}
            aria-label="More"
            aria-expanded={menuOpen}
            title="More"
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                minWidth: 170,
                background: PAPER,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                padding: 6,
                zIndex: 50,
              }}
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
              {onOpenTransitions && (
                <MenuItem
                  label="Transitions"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenTransitions();
                  }}
                />
              )}
              {onOpen3D && (
                <MenuItem
                  label="3D"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen3D();
                  }}
                />
              )}
              <MenuItem
                label="Export"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenExport();
                }}
              />
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: "transparent",
        border: "none",
        textAlign: "left",
        padding: "10px 12px",
        fontSize: 14,
        borderRadius: 6,
        color: destructive ? "#b91c1c" : INK,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = BG;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}
