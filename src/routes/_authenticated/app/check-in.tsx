import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { CheckInWizard } from "@/features/checkin/components/check-in-wizard";
import { canEditSubmission, useTodaySubmission } from "@/features/checkin/store";

export const Route = createFileRoute("/_authenticated/app/check-in")({
  head: () => ({
    meta: [{ title: "Morning check-in · SpartaFlow Hub" }],
  }),
  validateSearch: z.object({
    edit: z.coerce.number().optional(),
  }),
  component: CheckInPage,
});

function CheckInPage() {
  const { edit } = Route.useSearch();
  const submission = useTodaySubmission();
  const editing = !!edit && submission && canEditSubmission(submission);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Daily planning"
        title={editing ? "Edit morning check-in" : "Morning check-in"}
        description={
          editing
            ? "You have a 30-minute window after submission to make changes."
            : "Three to five quick steps. Helps you focus and your team see your day."
        }
      />
      <CheckInWizard existing={editing ? submission : null} />
    </AppShell>
  );
}
