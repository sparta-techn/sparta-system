import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createProject,
  generateProjectKey,
  listClients,
  listTemplates,
  useProjectsState,
} from "../store";
import { PROJECT_COLORS, PROJECT_ICONS } from "../mock-data";
import type { EnvironmentLink, ProjectMember, ProjectPriority, ProjectStatus } from "../types";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
}

export function CreateProjectDialog({ open, onOpenChange, templateId }: Props) {
  const clients = useMemo(() => listClients(), []);
  const templates = useMemo(() => listTemplates(), []);
  const people = useProjectsState((s) => s.people);
  const departments = useProjectsState((s) => s.departments);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [managerId, setManagerId] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(
    new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
  );
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [icon, setIcon] = useState(PROJECT_ICONS[0]);
  const [tpl, setTpl] = useState<string>(templateId ?? "none");
  const [advanced, setAdvanced] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [apiDocsUrl, setApiDocsUrl] = useState("");
  const [envs, setEnvs] = useState<EnvironmentLink[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!keyTouched) setKey(generateProjectKey(name));
  }, [name, keyTouched]);

  useEffect(() => {
    if (templateId) setTpl(templateId);
  }, [templateId]);

  // Default the pickers once the Supabase directory hydrates.
  useEffect(() => {
    if (!managerId && people.length > 0) setManagerId(people[0].id);
  }, [people, managerId]);
  useEffect(() => {
    if (!department && departments.length > 0) setDepartment(departments[0].name);
  }, [departments, department]);

  function reset() {
    setName("");
    setKey("");
    setKeyTouched(false);
    setDescription("");
    setClientId("none");
    setManagerId(people[0]?.id ?? "");
    setDepartment(departments[0]?.name ?? "");
    setMemberIds([]);
    setPriority("medium");
    setStatus("planning");
    setColor(PROJECT_COLORS[0]);
    setIcon(PROJECT_ICONS[0]);
    setTpl(templateId ?? "none");
    setAdvanced(false);
    setRepositoryUrl("");
    setFigmaUrl("");
    setApiDocsUrl("");
    setEnvs([]);
  }

  const canSubmit = name.trim().length >= 2 && key.trim().length >= 1 && managerId.length > 0;

  async function submit() {
    if (!canSubmit || submitting) return;
    const members: ProjectMember[] = [
      { employeeId: managerId, projectRole: "lead" },
      ...memberIds
        .filter((id) => id !== managerId)
        .map((id) => ({ employeeId: id, projectRole: "contributor" as const })),
    ];
    setSubmitting(true);
    try {
      // Await the real Supabase write — only close/navigate once the project (and
      // its member rows) actually persist. A failed insert surfaces its real
      // error below instead of a false success that vanishes on refresh.
      const project = await createProject({
        key: key.toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        clientId: clientId === "none" ? null : clientId,
        managerId,
        members,
        department: department as never,
        startDate,
        endDate,
        priority,
        status,
        health: "healthy",
        color,
        icon,
        repositoryUrl: repositoryUrl || undefined,
        figmaUrl: figmaUrl || undefined,
        apiDocsUrl: apiDocsUrl || undefined,
        environments: envs,
        templateId: tpl === "none" ? undefined : tpl,
      });
      onOpenChange(false);
      reset();
      navigate({ to: "/app/projects/$id", params: { id: project.id } });
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : "Please try again.";
      toast.error(`Couldn't create the project. ${detail}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>
            Spin up a project in under 60 seconds. Only name and key are required — everything else
            can be edited later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 overflow-y-auto px-1 -mx-1">
          {/* Identity row */}
          <div className="grid gap-3 sm:grid-cols-[80px_1fr_140px]">
            <div className="space-y-1">
              <Label>Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_ICONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-name">Name *</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Etihad Bus"
                autoFocus
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-key">Key *</Label>
              <Input
                id="proj-key"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value.toUpperCase());
                  setKeyTouched(true);
                }}
                placeholder="ETB"
                className="font-mono uppercase"
                maxLength={6}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Template */}
          <div className="space-y-1">
            <Label>Template</Label>
            <Select value={tpl} onValueChange={setTpl}>
              <SelectTrigger>
                <SelectValue placeholder="Start from scratch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Start from scratch</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="mr-2">{t.icon}</span>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tpl !== "none" ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="size-3" /> Pre-fills statuses, milestones, and roles from the
                template.
              </p>
            ) : null}
          </div>

          {/* Color */}
          <div className="space-y-1">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full border-2 transition",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>

          {/* People + client */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Project manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {people.slice(0, 30).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Internal / no client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ProjectPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["low", "medium", "high", "critical"] satisfies ProjectPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-start">Start date</Label>
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-end">End date</Label>
              <Input
                id="proj-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Advanced */}
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {advanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            Advanced (links, environments, status)
          </button>
          {advanced ? (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Initial status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["planning", "active", "on_hold"] satisfies ProjectStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="repo">Repository URL</Label>
                <Input
                  id="repo"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="figma">Figma URL</Label>
                <Input
                  id="figma"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  placeholder="https://figma.com/..."
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="docs">API documentation URL</Label>
                <Input
                  id="docs"
                  value={apiDocsUrl}
                  onChange={(e) => setApiDocsUrl(e.target.value)}
                  placeholder="https://docs..."
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Environments</Label>
                <div className="space-y-2">
                  {envs.map((env, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={env.label}
                        onChange={(e) =>
                          setEnvs(
                            envs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)),
                          )
                        }
                        placeholder="Production"
                        className="max-w-[140px]"
                      />
                      <Input
                        value={env.url}
                        onChange={(e) =>
                          setEnvs(
                            envs.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)),
                          )
                        }
                        placeholder="https://..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEnvs(envs.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEnvs([...envs, { label: "", url: "" }])}
                  >
                    Add environment
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
