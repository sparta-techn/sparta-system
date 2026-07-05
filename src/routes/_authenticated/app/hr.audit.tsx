import { createFileRoute } from "@tanstack/react-router";
import { AuditLogView } from "@/features/hr/components/audit-log-view";

export const Route = createFileRoute("/_authenticated/app/hr/audit")({
  head: () => ({ meta: [{ title: "Audit log · SpartaFlow Hub" }] }),
  component: () => <AuditLogView />,
});
