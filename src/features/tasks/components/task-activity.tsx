import { useMemo } from "react";
import { useTasksState } from "../store";
import { employeeById } from "../utils";

export function TaskActivityTimeline({ taskId }: { taskId: string }) {
  const activity = useTasksState((s) => s.activity);
  const events = useMemo(
    () => activity.filter((a) => a.taskId === taskId).sort((a, b) => (a.at < b.at ? 1 : -1)),
    [activity, taskId],
  );

  if (!events.length) {
    return (
      <p className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
        No activity recorded.
      </p>
    );
  }

  return (
    <ol className="relative ml-2 space-y-3 border-l pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className="absolute -left-[26px] top-1.5 grid size-3 place-items-center rounded-full bg-primary"
            aria-hidden
          />
          <p className="text-sm">{e.summary}</p>
          <p className="text-xs text-muted-foreground">
            {employeeById(e.actorId)?.name ?? "System"} · {new Date(e.at).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
