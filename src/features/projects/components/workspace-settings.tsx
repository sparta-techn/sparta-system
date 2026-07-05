import { useState } from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listTemplates, updateWorkspace, useProjectsState } from "../store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMEZONES = [
  "Asia/Dubai",
  "Asia/Karachi",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Singapore",
];
const LANGUAGES = ["English", "Arabic", "Spanish", "French", "German", "Hindi", "Urdu"];

export function WorkspaceSettingsPanel() {
  const workspace = useProjectsState((s) => s.workspace);
  const templates = listTemplates();
  const [draft, setDraft] = useState(workspace);
  const [statusesText, setStatusesText] = useState(workspace.defaultStatuses.join(", "));

  function save() {
    updateWorkspace({
      ...draft,
      defaultStatuses: statusesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  function toggleDay(d: string) {
    setDraft((dr) => ({
      ...dr,
      workingDays: dr.workingDays.includes(d)
        ? dr.workingDays.filter((x) => x !== d)
        : [...dr.workingDays, d],
    }));
  }

  function toggleLang(l: string) {
    setDraft((dr) => ({
      ...dr,
      languages: dr.languages.includes(l)
        ? dr.languages.filter((x) => x !== l)
        : [...dr.languages, l],
    }));
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Company</h2>
        <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
          <div className="space-y-1">
            <Label>Logo</Label>
            <Input
              maxLength={2}
              value={draft.logoInitial}
              onChange={(e) => setDraft({ ...draft, logoInitial: e.target.value.toUpperCase() })}
              className="text-center font-display text-xl"
            />
          </div>
          <div className="space-y-1">
            <Label>Company name</Label>
            <Input
              value={draft.companyName}
              onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Working hours</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Timezone</Label>
            <Select
              value={draft.timezone}
              onValueChange={(v) => setDraft({ ...draft, timezone: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Start</Label>
            <Input
              type="time"
              value={draft.workingHours.start}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  workingHours: { ...draft.workingHours, start: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>End</Label>
            <Input
              type="time"
              value={draft.workingHours.end}
              onChange={(e) =>
                setDraft({ ...draft, workingHours: { ...draft.workingHours, end: e.target.value } })
              }
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Working days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const active = draft.workingDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
                  aria-pressed={active}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-base font-semibold">Languages</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => {
            const active = draft.languages.includes(l);
            return (
              <Badge
                key={l}
                variant={active ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleLang(l)}
              >
                {l}
              </Badge>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Defaults</h2>
        <div className="space-y-1">
          <Label>Default task statuses (comma-separated)</Label>
          <Input value={statusesText} onChange={(e) => setStatusesText(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Applied when a project doesn't use a template.
          </p>
        </div>
        <div className="space-y-1">
          <Label>Default project template</Label>
          <Select
            value={draft.defaultProjectTemplate ?? "none"}
            onValueChange={(v) =>
              setDraft({ ...draft, defaultProjectTemplate: v === "none" ? null : v })
            }
          >
            <SelectTrigger className="max-w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background py-3">
        <Button onClick={save} className="gap-2">
          <Save className="size-4" /> Save workspace
        </Button>
      </div>
    </div>
  );
}
