import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Trash2, X } from "lucide-react";
import type { SurveyNote } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface Props {
  note: SurveyNote;
  onClose: () => void;
  onSave: (text: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

// SpeechRecognition may not exist on all browsers/types
type SRConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function NoteEditor({ note, onClose, onSave, onDelete }: Props) {
  const [text, setText] = useState(note.text ?? "");
  const [listening, setListening] = useState(false);
  const recRef = useRef<InstanceType<SRConstructor> | null>(null);
  const baseRef = useRef<string>(note.text ?? "");

  useEffect(() => {
    setText(note.text ?? "");
    baseRef.current = note.text ?? "";
  }, [note.id, note.text]);

  const SR: SRConstructor | undefined =
    (typeof window !== "undefined" &&
      ((window as unknown as { SpeechRecognition?: SRConstructor }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition)) ||
    undefined;

  function toggleDictation() {
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    baseRef.current = text ? text + (text.endsWith(" ") ? "" : " ") : "";
    rec.onresult = (e) => {
      let out = "";
      for (let i = 0; i < e.results.length; i++) {
        out += e.results[i][0].transcript;
      }
      setText(baseRef.current + out);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  useEffect(() => {
    return () => {
      recRef.current?.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="bg-background rounded-xl shadow-2xl max-w-md w-full p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Note</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 -m-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          autoFocus
          rows={5}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            baseRef.current = e.target.value;
          }}
          placeholder="Type or dictate…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-2">
            {SR && (
              <Button
                type="button"
                variant={listening ? "default" : "outline"}
                size="sm"
                onClick={toggleDictation}
                className="gap-1.5"
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening ? "Stop" : "Dictate"}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => onSave(text.trim())}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
