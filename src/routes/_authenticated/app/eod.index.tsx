import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EodWizard } from "@/features/eod/components/eod-wizard";
import { ManagerEodOverview } from "@/features/eod/components/manager-eod-overview";
import { canEditEod, getEodSubmission } from "@/features/eod/store";
import type { WorkSessionSummary } from "@/features/eod/types";
import { getSubmission as getMorningSubmission } from "@/features/checkin/store";
import { getMiddaySubmission } from "@/features/midday/store";

export const Route = createFileRoute("/_authenticated/app/eod/")({
  head: () => ({
    meta: [{ title: "End-of-day report · SpartaFlow Hub" }],
  }),
  validateSearch: z.object({
    edit: z.coerce.number().optional(),
    view: z.enum(["manager", "hr"]).optional(),
  }),
  component: EodPage,
});

function EodPage() {
  const { edit, view } = Route.useSearch();

  if (view === "manager" || view === "hr") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Daily handover"
          title={view === "hr" ? "EOD participation" : "EOD operational view"}
          description={
            view === "hr"
              ? "Who submitted, missing reports. No qualitative work content."
              : "Common blockers, completion, tomorrow risks, help requests routed across teams."
          }
        />
        <ManagerEodOverview hrMode={view === "hr"} />
      </AppShell>
    );
  }

  const submission = typeof window !== "undefined" ? getEodSubmission() : null;
  const editing = !!edit && submission && canEditEod(submission);
  const sessionSummary = buildSessionSummary();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Daily handover"
        title={editing ? "Edit end-of-day report" : "End-of-day report"}
        description={
          editing
            ? "You have a 30-minute window after submission to make changes."
            : "Seven quick sections. Hand off the day cleanly — under five minutes."
        }
      />
      <EodWizard existing={editing ? submission : null} sessionSummary={sessionSummary} />
    </AppShell>
  );
}

/**
 * Synthesise the work-session summary from the (Supabase-backed) check-in and
 * midday stores. Break minutes and dependency counts have no real source in this
 * summary yet, so they read 0 rather than fabricated constants. Replace with the
 * `select_today_work_session_summary` RPC when it lands.
 */
function buildSessionSummary(): WorkSessionSummary {
  if (typeof window === "undefined") {
    return {
      workedMinutes: 0,
      breakMinutes: 0,
      morningCheckInDone: false,
      middayStatusDone: false,
      dependenciesCreated: 0,
      dependenciesResolved: 0,
    };
  }
  const morning = getMorningSubmission();
  const midday = getMiddaySubmission();
  const checkInTime = morning ? new Date(morning.submittedAt) : null;
  const now = new Date();
  const checkOut = now;
  const workedMinutes = checkInTime
    ? Math.max(0, Math.round((checkOut.getTime() - checkInTime.getTime()) / 60000))
    : 0;
  return {
    checkIn: checkInTime
      ? checkInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : undefined,
    checkOut: checkOut.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    workedMinutes,
    breakMinutes: 0,
    morningCheckInDone: !!morning,
    middayStatusDone: !!midday,
    dependenciesCreated: 0,
    dependenciesResolved: midday?.blockerLinks.filter((b) => b.resolved).length ?? 0,
  };
}
