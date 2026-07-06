import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listProjects, saveProject, deleteProject, uid, listFloors, listPoints, saveFloor } from "@/lib/db";
import type { ProjectMeta } from "@/lib/types";

interface Row extends ProjectMeta {
  floorCount: number;
  pointCount: number;
}

export function ProjectList() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(data: Omit<ProjectMeta, "id" | "createdAt" | "updatedAt">) {
    const id = uid();
    const now = Date.now();
    await saveProject({ ...data, id, createdAt: now, updatedAt: now });
    // seed a first floor
    await saveFloor({
      id: uid(),
      projectId: id,
      name: "1st Floor",
      order: 0,
      boundary: [],
      createdAt: now,
      updatedAt: now,
    });
    setOpen(false);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project and all its data?")) return;
    await deleteProject(id);
    refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Floor Survey</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Topographical mapping for foundation inspection
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" /> New project
            </Button>
          </DialogTrigger>
          <NewProjectDialog onCreate={handleCreate} />
        </Dialog>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-medium">No projects yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a project to start capturing floor elevations.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex items-center justify-between p-4">
              <Link
                to="/projects/$id"
                params={{ id: p.id }}
                className="flex-1 min-w-0"
              >
                <div className="font-medium truncate">{p.name}</div>
                <div className="mt-1 text-xs text-muted-foreground truncate">
                  {p.address || "No address"} · {p.inspectionDate || "no date"}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {p.floorCount} floor{p.floorCount === 1 ? "" : "s"} · {p.pointCount} point
                  {p.pointCount === 1 ? "" : "s"}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(p.id)}
                aria-label="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewProjectDialog({
  onCreate,
}: {
  onCreate: (p: Omit<ProjectMeta, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [client, setClient] = useState("");
  const [inspector, setInspector] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label htmlFor="np-date">Inspection date</Label>
          <Input id="np-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="np-name">Project name</Label>
          <Input
            id="np-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smith Residence"
          />
        </div>
        <div>
          <Label htmlFor="np-addr">Address</Label>
          <Input id="np-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="np-client">Client</Label>
            <Input id="np-client" value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="np-insp">Inspector</Label>
            <Input id="np-insp" value={inspector} onChange={(e) => setInspector(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="np-notes">Notes</Label>
          <Textarea id="np-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onCreate({
              name: name.trim() || "Untitled project",
              address,
              client,
              inspector,
              inspectionDate: date,
              notes,
            })
          }
        >
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
