import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTemplate, useProjectsState } from "../store";
import { CreateProjectDialog } from "./create-project-dialog";

export function TemplateList() {
  const templates = useProjectsState((s) => s.templates);
  const [createOpen, setCreateOpen] = useState(false);
  const [useTpl, setUseTpl] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Project templates pre-fill statuses, milestones, and roles so a new project starts in
          seconds.
        </p>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New template
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span
                className="grid size-10 place-items-center rounded-lg text-xl"
                style={{ background: `${t.color}22`, color: t.color }}
                aria-hidden
              >
                {t.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.usageCount} projects · ~{t.recommendedDuration} days
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Default statuses
              </p>
              <div className="flex flex-wrap gap-1">
                {t.defaultStatuses.map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Default milestones
              </p>
              <div className="flex flex-wrap gap-1">
                {t.defaultMilestones.map((m) => (
                  <Badge key={m} variant="outline" className="font-normal">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <Button size="sm" className="w-full gap-1.5" onClick={() => setUseTpl(t.id)}>
              <Sparkles className="size-4" /> Use template
            </Button>
          </Card>
        ))}
      </div>

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CreateProjectDialog
        open={!!useTpl}
        onOpenChange={(v) => !v && setUseTpl(undefined)}
        templateId={useTpl}
      />
    </div>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState("📦");
  const [statuses, setStatuses] = useState("Backlog, In Progress, Review, Done");
  const [milestones, setMilestones] = useState("Kickoff, Build, Launch");

  function submit() {
    if (!name.trim()) return;
    createTemplate({
      name: name.trim(),
      description: desc.trim(),
      icon,
      color: "#3B82F6",
      defaultStatuses: statuses
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      defaultMilestones: milestones
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      defaultRoles: ["lead", "contributor", "reviewer"],
      recommendedDuration: 60,
    });
    setName("");
    setDesc("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project template</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mobile App MVP"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Icon (emoji)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-20" />
          </div>
          <div className="space-y-1">
            <Label>Default statuses (comma-separated)</Label>
            <Input value={statuses} onChange={(e) => setStatuses(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Default milestones (comma-separated)</Label>
            <Input value={milestones} onChange={(e) => setMilestones(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
