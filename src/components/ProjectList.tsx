import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Trash2,
  Download,
  Copy,
  MoreVertical,
  RotateCcw,
  ImagePlus,
  Share,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  listProjects,
  listTrashedProjects,
  saveProject,
  deleteProject,
  trashProject,
  restoreProject,
  uid,
  listFloors,
  listPoints,
  saveFloor,
  markProjectExported,
} from "@/lib/db";
import {
  exportProject,
  bundleFilename,
  downloadBundle,
  importProject,
  duplicateProject,
} from "@/lib/bundle";
import { OfflineModeToggle } from "@/components/OfflineModeToggle";
import type { ProjectMeta } from "@/lib/types";

interface Row extends ProjectMeta {
  floorCount: number;
  pointCount: number;
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function isUnbackedUp(p: ProjectMeta): boolean {
  if (!p.lastExportedAt) return true;
  return p.updatedAt > p.lastExportedAt + 1000;
}

export function ProjectList() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [trashed, setTrashed] = useState<ProjectMeta[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nagDismissed, setNagDismissed] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [sharingAll, setSharingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  async function refresh() {
    const list = await listProjects();
    const enriched: Row[] = [];
    for (const p of list) {
      const floors = await listFloors(p.id);
      let pts = 0;
      for (const f of floors) pts += (await listPoints(f.id)).length;
      enriched.push({ ...p, floorCount: floors.length, pointCount: pts });
    }
    setProjects(enriched);
    setTrashed(await listTrashedProjects());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  /** Distress Survey-style: empty project + 1st Floor, open immediately — no dialog. */
  async function startNew(prefill?: { client?: string; address?: string; name?: string }) {
    const id = uid();
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    await saveProject({
      id,
      name: (prefill?.name ?? "").trim(),
      address: (prefill?.address ?? "").trim(),
      client: (prefill?.client ?? "").trim(),
      inspector: "",
      inspectionDate: today, // always today — never Toolbox scheduled date
      notes: "",
      createdAt: now,
      updatedAt: now,
    });
    await saveFloor({
      id: uid(),
      projectId: id,
      name: "1st Floor",
      order: 0,
      boundary: [],
      createdAt: now,
      updatedAt: now,
    });
    navigate({ to: "/projects/$id", params: { id } });
  }

  // Toolbox door: ?client=&address=&project= (phone optional, ignored).
  // Open setup with those fields filled — do not land on home, do not skip setup.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const client = params.get("client");
    const address = params.get("address");
    const projectName = params.get("project");
    if (client == null && address == null && projectName == null) return;
    // Clear query so a refresh doesn't spawn another project.
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.pathname + url.hash);
    void startNew({
      client: client ?? "",
      address: address ?? "",
      name: projectName ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTrash(p: Row) {
    if (!confirm(`Move "${p.name || "Untitled"}" to trash? You can restore it later.`)) return;
    await trashProject(p.id);
    await refresh();
    toast.success("Moved to trash");
  }

  async function handleRestore(p: ProjectMeta) {
    await restoreProject(p.id);
    await refresh();
    toast.success("Restored");
  }

  async function handleDeleteForever(p: ProjectMeta) {
    if (!confirm(`Permanently delete "${p.name || "Untitled"}"? This cannot be undone.`)) return;
    await deleteProject(p.id);
    await refresh();
    toast.success("Deleted");
  }

  async function handleExport(p: Row) {
    try {
      const blob = await exportProject(p.id);
      downloadBundle(blob, bundleFilename(p.name || "Untitled"));
      await markProjectExported(p.id);
      await refresh();
      toast.success("Project exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function handleExportAll() {
    const unsaved = projects.filter(isUnbackedUp);
    const targets = unsaved.length > 0 ? unsaved : projects;
    if (targets.length === 0) {
      toast("Nothing to export");
      return;
    }
    setExportingAll(true);
    let ok = 0;
    let failed = 0;
    for (const p of targets) {
      try {
        const blob = await exportProject(p.id);
        downloadBundle(blob, bundleFilename(p.name || "Untitled"));
        await markProjectExported(p.id);
        ok++;
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        failed++;
      }
    }
    setExportingAll(false);
    await refresh();
    if (failed === 0) toast.success(`Exported ${ok} project${ok === 1 ? "" : "s"}`);
    else toast.error(`Exported ${ok}, failed ${failed}`);
  }

  async function handleShare(p: Row) {
    try {
      const blob = await exportProject(p.id);
      const filename = bundleFilename(p.name || "Untitled");
      const file = new File([blob], filename, { type: "application/json" });
      const shareable =
        typeof navigator !== "undefined" &&
        !!navigator.share &&
        !!navigator.canShare &&
        navigator.canShare({ files: [file] });
      if (shareable) {
        await navigator.share({ files: [file], title: p.name || "Floor Survey" });
      } else {
        downloadBundle(blob, filename);
      }
      await markProjectExported(p.id);
      await refresh();
      toast.success(shareable ? "Project shared" : "Project exported");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Share failed");
    }
  }

  async function handleShareAll() {
    const unsaved = projects.filter(isUnbackedUp);
    const targets = unsaved.length > 0 ? unsaved : projects;
    if (targets.length === 0) {
      toast("Nothing to share");
      return;
    }
    setSharingAll(true);
    try {
      const files: File[] = [];
      for (const p of targets) {
        const blob = await exportProject(p.id);
        files.push(
          new File([blob], bundleFilename(p.name || "Untitled"), { type: "application/json" }),
        );
      }
      const shareable =
        typeof navigator !== "undefined" &&
        !!navigator.share &&
        !!navigator.canShare &&
        navigator.canShare({ files });
      if (shareable) {
        await navigator.share({ files, title: "Floor Survey projects" });
      } else {
        for (const f of files) {
          downloadBundle(f, f.name);
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      for (const p of targets) await markProjectExported(p.id);
      await refresh();
      toast.success(
        shareable
          ? `Shared ${files.length} project${files.length === 1 ? "" : "s"}`
          : `Exported ${files.length} project${files.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Share failed");
    } finally {
      setSharingAll(false);
    }
  }

  async function handleDuplicate(p: Row) {
    try {
      await duplicateProject(p.id);
      await refresh();
      toast.success("Project duplicated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    }
  }

  async function handleImportFile(file: File) {
    try {
      const newId = await importProject(file);
      toast.success("Project imported");
      await refresh();
      navigate({ to: "/projects/$id", params: { id: newId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <div className="relative mx-auto max-w-lg px-[22px] pb-[88px] pt-8">
      <header className="mb-8 text-center">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Floor Survey</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Field reporter for foundation elevations
        </p>
        <OfflineModeToggle />
        <button
          type="button"
          onClick={() => void startNew()}
          className="mt-6 flex w-full items-center gap-4 rounded-[14px] border border-border bg-card px-[18px] py-[18px] text-left shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#f3d8ce] text-[28px]">
            🏠
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">New Survey</span>
            <span className="block text-xs font-medium text-muted-foreground">
              Floor level survey · elevations + plan
            </span>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 text-[13px] text-muted-foreground underline"
        >
          Import a saved file
        </button>
      </header>

      <div className="mb-2.5 mt-7 flex items-center justify-between px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>Recent</span>
        <span>
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </span>
      </div>

      {(() => {
        const unsaved = projects.filter(isUnbackedUp);
        if (nagDismissed || unsaved.length === 0) return null;
        return (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex-1">
              <div className="font-medium">
                {unsaved.length} project{unsaved.length === 1 ? "" : "s"} not exported
              </div>
              <div className="mt-0.5 text-xs text-amber-800">
                Export saves a .json file you can re-import if the app icon is removed.
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                onClick={() => void handleExportAll()}
                disabled={exportingAll || sharingAll}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                {exportingAll ? "Exporting…" : "Export all"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleShareAll()}
                disabled={exportingAll || sharingAll}
              >
                <Share className="mr-1 h-3.5 w-3.5" />
                {sharingAll ? "Sharing…" : "Share all"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-900 hover:text-amber-900"
                onClick={() => setNagDismissed(true)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-[13px] text-muted-foreground">
          No files yet. Start one above.
        </div>
      ) : (
        <div className="grid gap-2">
          {projects.map((p) => (
            <Card key={p.id} className="flex items-center justify-between px-3.5 py-3">
              <Link to="/projects/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name || "Untitled survey"}</div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {p.address || "No address"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {p.inspectionDate || "no date"}
                </div>
                <div className="mt-1">
                  {isUnbackedUp(p) ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                      {p.lastExportedAt ? "Unsaved changes" : "Not exported"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      Exported {formatAgo(p.lastExportedAt!)}
                    </span>
                  )}
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Project actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleDuplicate(p)}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                  </DropdownMenuItem>
                  {p.parentProjectId && (
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({
                          to: "/projects/$id",
                          params: { id: p.id },
                          hash: "align",
                        })
                      }
                    >
                      <ImagePlus className="mr-2 h-4 w-4" /> Replace plan image…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => void handleExport(p)}>
                    <Download className="mr-2 h-4 w-4" /> Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleShare(p)}>
                    <Share className="mr-2 h-4 w-4" /> Share
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void handleTrash(p)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Trash</DialogTitle>
          </DialogHeader>
          {trashed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Trash is empty.</p>
          ) : (
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
              {trashed.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name || "Untitled"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.address || "No address"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Trashed {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => void handleRestore(p)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDeleteForever(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <button
        type="button"
        onClick={() => {
          if (trashed.length === 0) {
            toast("Trash is empty");
            return;
          }
          setTrashOpen(true);
        }}
        aria-label={trashed.length > 0 ? `Trash (${trashed.length})` : "Trash"}
        className={`fixed right-[18px] bottom-[calc(18px+var(--app-bottom-offset,0px))] z-40 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${
          trashed.length === 0 ? "cursor-default opacity-[0.35]" : "cursor-pointer opacity-100"
        }`}
      >
        <span className="text-[24px] leading-none" aria-hidden>
          🗑
        </span>
        {trashed.length > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
            {trashed.length}
          </span>
        )}
      </button>
    </div>
  );
}
