import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MOCK_DEPARTMENTS, MOCK_EMPLOYEES } from "../mock-data";
import type { HelpRequest, PriorityLevel } from "../types";

interface Props {
  value: HelpRequest;
  onChange: (next: HelpRequest) => void;
}

const LEVELS: PriorityLevel[] = ["low", "medium", "high", "urgent"];

export function HelpRequestEditor({ value, onChange }: Props) {
  function patch(p: Partial<HelpRequest>) {
    onChange({ ...value, ...p });
  }

  const filteredEmployees = value.departmentId
    ? MOCK_EMPLOYEES.filter((e) => e.departmentId === value.departmentId)
    : MOCK_EMPLOYEES;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="space-y-0.5">
          <Label htmlFor="help-toggle" className="text-sm font-medium">
            I need help today
          </Label>
          <p className="text-xs text-muted-foreground">Route a request to a teammate. Optional.</p>
        </div>
        <Switch
          id="help-toggle"
          checked={value.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
        />
      </div>

      {value.enabled ? (
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="help-dept">Department</Label>
            <Select
              value={value.departmentId ?? ""}
              onValueChange={(v) => patch({ departmentId: v, employeeId: undefined })}
            >
              <SelectTrigger id="help-dept">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_DEPARTMENTS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-emp">Person</Label>
            <Select value={value.employeeId ?? ""} onValueChange={(v) => patch({ employeeId: v })}>
              <SelectTrigger id="help-emp">
                <SelectValue placeholder="Select teammate" />
              </SelectTrigger>
              <SelectContent>
                {filteredEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="help-desc">What do you need?</Label>
            <Textarea
              id="help-desc"
              rows={3}
              value={value.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="A short, concrete ask works best."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-prio">Priority</Label>
            <Select
              value={value.priority ?? ""}
              onValueChange={(v) => patch({ priority: v as PriorityLevel })}
            >
              <SelectTrigger id="help-prio">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l[0].toUpperCase() + l.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-date">Needed by</Label>
            <Input
              id="help-date"
              type="date"
              value={value.desiredDate ?? ""}
              onChange={(e) => patch({ desiredDate: e.target.value })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
