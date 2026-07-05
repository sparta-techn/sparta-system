import { createFileRoute } from "@tanstack/react-router";
import { LeaveManager } from "@/features/hr/components/leave-manager";

export const Route = createFileRoute("/_authenticated/app/hr/leave")({
  head: () => ({ meta: [{ title: "Leave · SpartaFlow Hub" }] }),
  component: () => <LeaveManager />,
});
