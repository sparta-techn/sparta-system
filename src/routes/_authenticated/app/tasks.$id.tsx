import { createFileRoute } from "@tanstack/react-router";
import { TaskDetail } from "@/features/tasks/components/task-detail";

export const Route = createFileRoute("/_authenticated/app/tasks/$id")({
  head: () => ({ meta: [{ title: "Task · SpartaFlow Hub" }] }),
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { id } = Route.useParams();
  return <TaskDetail taskId={id} />;
}
