import { createFileRoute } from "@tanstack/react-router";
import { SavedReportsList } from "@/features/analytics/components/saved-reports";

export const Route = createFileRoute("/_authenticated/app/analytics/saved")({
  head: () => ({ meta: [{ title: "Saved reports · SpartaFlow Hub" }] }),
  component: () => <SavedReportsList />,
});
