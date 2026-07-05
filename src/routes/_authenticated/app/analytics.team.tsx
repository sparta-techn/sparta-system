import { createFileRoute } from "@tanstack/react-router";
import { FiltersBar } from "@/features/analytics/components/filters-bar";
import { TeamDashboard } from "@/features/analytics/components/team-dashboard";

export const Route = createFileRoute("/_authenticated/app/analytics/team")({
  head: () => ({ meta: [{ title: "Team analytics · SpartaFlow Hub" }] }),
  component: () => (
    <>
      <FiltersBar scope="team" />
      <TeamDashboard />
    </>
  ),
});
