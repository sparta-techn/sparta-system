import { createFileRoute } from "@tanstack/react-router";
import { MyTimeLogs } from "@/features/time-tracking/components/my-time-logs";

export const Route = createFileRoute("/_authenticated/app/tasks/time")({
  head: () => ({ meta: [{ title: "My time logs · SpartaFlow Hub" }] }),
  component: TimeLogsPage,
});

function TimeLogsPage() {
  return <MyTimeLogs />;
}
