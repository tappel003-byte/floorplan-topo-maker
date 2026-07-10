import { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import type { NotePin } from "@/lib/notePins";
import type { CanvasTransform } from "./PlanCanvas";

interface Props {
  pin: NotePin;
  transform: CanvasTransform;
  containerWidth: number;
  containerHeight: number;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onDelete: () => void;
}

/**
 * Small floating card near a note pin. NO fullscreen backdrop — the rest of
 * the app stays fully interactive. Tap the pin again or the X to close.
 */
export function NoteOverlay({
  pin,
  transform,
  containerWidth,
  containerHeight,
  onChangeText,
  onClose,
  onDelete,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Autofocus so the iOS keyboard (with mic) is one tap away.
    taRef.current?.focus();
  }, [pin.id]);

  const sx = pin.x * transform.scale + transform.tx;
  const sy = pin.y * transform.scale + transform.ty;

  const CARD_W = 240;
  const CARD_H = 160;
  const GAP = 18;

  // Prefer above the pin; flip below if not enough room.
  let top = sy - GAP - CARD_H;
  if (top < 8) top = sy + GAP;
  if (top + CARD_H > containerHeight - 8) top = Math.max(8, containerHeight - 8 - CARD_H);

  let left = sx - CARD_W / 2;
  left = Math.max(8, Math.min(left, containerWidth - CARD_W - 8));

  return (
    <div
      role="dialog"
      aria-label={`Note ${pin.index}`}
      className="absolute z-30 rounded-xl shadow-lg border border-amber-300 bg-amber-50/95 backdrop-blur"
      style={{ left, top, width: CARD_W }}
      // Stop pointer/touch from bubbling to the canvas gesture handlers.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-amber-200">
        <span className="text-xs font-semibold text-amber-900">Note {pin.index}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Delete note"
            onClick={onDelete}
            className="p-1 text-amber-700 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close note"
            onClick={onClose}
            className="p-1 text-amber-700 hover:text-amber-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <textarea
        ref={taRef}
        value={pin.text}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder="Tap the mic on the keyboard to dictate…"
        className="w-full h-[120px] resize-none bg-transparent p-2 text-sm text-amber-950 placeholder:text-amber-700/60 focus:outline-none"
      />
    </div>
  );
}
