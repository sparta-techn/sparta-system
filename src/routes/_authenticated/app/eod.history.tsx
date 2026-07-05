import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EodHistoryList } from "@/features/eod/components/eod-history-list";

export const Route = createFileRoute("/_authenticated/app/eod/history")({
  head: () => ({
    meta: [{ title: "EOD history · SpartaFlow Hub" }],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Daily handover"
        title="End-of-day report history"
        description="Browse your previous reports. Search by keyword or narrow with a date range."
      />
      <EodHistoryList />
    </AppShell>
  );
}
