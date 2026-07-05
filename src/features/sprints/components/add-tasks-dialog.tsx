import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTasksState } from "@/features/tasks/store";
import { addTasksToSprint } from "../store";
import type { Sprint } from "../types";

export function AddTasksDialog({
  sprint,
  open,
  onOpenChange,
}: {
  sprint: Sprint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const allTasks = useTasksState((s) => s.tasks);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks
      .filter(
        (t) =>
          t.projectId === sprint.projectId &&
          !t.parentTaskId &&
          !t.deletedAt &&
          !t.archivedAt &&
          t.sprintId !== sprint.id,
      )
      .filter((t) =>
        q
          ? t.title.toLowerCase().includes(q) || t.ref.toLowerCase().includes(q)
          : true,
      )
      .slice(0, 80);
  }, [allTasks, search, sprint.id, sprint.projectId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!selected.size) return;
    addTasksToSprint(sprint.id, Array.from(selected));
    setSelected(new Set());
    setSearch("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add tasks to sprint</DialogTitle>
          <DialogDescription>
            Pick existing tasks from <span className="font-medium">{sprint.name}</span>'s project backlog.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by ref or title…"
            className="pl-8"
          />
        </div>

        <div className="max-h-[420px] divide-y overflow-y-auto rounded-md border">
          {candidates.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No matching tasks. Tasks belonging to other projects or already in this sprint are hidden.
            </div>
          ) : (
            candidates.map((t) => {
              const checked = selected.has(t.id);
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={checked}
                    onChange={() => toggle(t.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono uppercase">{t.ref}</span>
                      <span aria-hidden>·</span>
                      <span className="capitalize">{t.status.replace("_", " ")}</span>
                      {t.storyPoints ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{t.storyPoints} pts</span>
                        </>
                      ) : null}
                    </div>
                    <div className="line-clamp-1 text-sm font-medium">{t.title}</div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!selected.size} onClick={submit}>
              Add {selected.size || ""} task{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
