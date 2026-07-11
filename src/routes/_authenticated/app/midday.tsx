import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-context";
import { requiresMidday } from "@/features/hr/employment-type";
import { ManagerMiddayOverview } from "@/features/midday/components/manager-midday-overview";
import { MiddayWizard } from "@/features/midday/components/midday-wizard";
import { canEditMidday, getMiddaySubmission } from "@/features/midday/store";

export const Route = createFileRoute("/_authenticated/app/midday")({
  head: () => ({
    meta: [{ title: "Midday status · SpartaFlow Hub" }],
  }),
  validateSearch: z.object({
    edit: z.coerce.number().optional(),
    view: z.enum(["manager", "hr"]).optional(),
  }),
  component: MiddayPage,
});

function MiddayPage() {
  const { edit, view } = Route.useSearch();
  const { employmentType } = useAuth();

  if (view === "manager" || view === "hr") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Operational visibility"
          title={view === "hr" ? "Midday participation" : "Midday operational view"}
          description={
            view === "hr"
              ? "Submission and completion rates only. Work content is hidden."
              : "Who shipped a report, average progress, common blockers, departments at risk."
          }
        />
        <ManagerMiddayOverview hrMode={view === "hr"} />
      </AppShell>
    );
  }

  // Part-time employees don't file a midday pulse — the nav item and dashboard
  // tile are already hidden for them; guard the direct URL too so they don't see
  // (or submit) the wizard. The manager/HR overview above stays available.
  if (!requiresMidday(employmentType)) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Midday update"
          title="Not part of your schedule"
          description="Midday status reports aren't required for part-time employees. Your check-in and end-of-day reports are all you need."
        />
      </AppShell>
    );
  }

  const submission = typeof window !== "undefined" ? getMiddaySubmission() : null;
  const editing = !!edit && submission && canEditMidday(submission);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Midday update"
        title={editing ? "Edit midday status" : "Midday status report"}
        description={
          editing
            ? "You have a 30-minute window after submission to make changes."
            : "Six quick sections. Keeps managers in the loop without breaking your flow."
        }
      />
      <MiddayWizard existing={editing ? submission : null} />
    </AppShell>
  );
}
