import { createFileRoute } from "@tanstack/react-router";
import { FiltersBar } from "@/features/analytics/components/filters-bar";
import { PersonalDashboard } from "@/features/analytics/components/personal-dashboard";

export const Route = createFileRoute("/_authenticated/app/analytics/")({
  head: () => ({ meta: [{ title: "My analytics · SpartaFlow Hub" }] }),
  component: () => (
    <>
      <FiltersBar scope="personal" />
      <PersonalDashboard />
    </>
  ),
});
