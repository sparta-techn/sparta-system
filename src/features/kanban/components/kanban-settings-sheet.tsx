import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { STATUS_LABEL, STATUS_ORDER, type TaskStatus } from "@/features/tasks/types";
import { moveColumn, resetSettings, setWipLimit, toggleColumn, useKanbanState } from "../store";

export function KanbanSettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const columns = useKanbanState((s) => s.settings.columns);
  const wipLimits = useKanbanState((s) => s.settings.wipLimits);

  const ordered: TaskStatus[] = [...columns, ...STATUS_ORDER.filter((s) => !columns.includes(s))];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Board settings</SheetTitle>
          <SheetDescription>
            Show or hide columns, reorder them, and set visual WIP limits. WIP limits are display
            only — they don't block status changes.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {ordered.map((status) => {
            const visible = columns.includes(status);
            const idx = columns.indexOf(status);
            return (
              <div
                key={status}
                className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
              >
                <Switch
                  checked={visible}
                  onCheckedChange={() => toggleColumn(status)}
                  aria-label={`Toggle ${STATUS_LABEL[status]}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{STATUS_LABEL[status]}</p>
                  <p className="text-xs text-muted-foreground">
                    {visible ? `Position ${idx + 1}` : "Hidden"}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={wipLimits[status] ?? ""}
                  placeholder="WIP"
                  className="h-8 w-20"
                  onChange={(e) => setWipLimit(status, Number(e.target.value) || 0)}
                />
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!visible || idx <= 0}
                    onClick={() => moveColumn(status, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!visible || idx === columns.length - 1}
                    onClick={() => moveColumn(status, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetSettings} className="gap-1.5">
            <RotateCcw className="size-3.5" /> Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
