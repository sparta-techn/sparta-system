import { createFileRoute } from "@tanstack/react-router";
import { ProjectsDashboard } from "@/features/projects/components/projects-dashboard";

export const Route = createFileRoute("/_authenticated/app/projects/")({
  head: () => ({ meta: [{ title: "Projects overview · SpartaFlow Hub" }] }),
  component: () => <ProjectsDashboard />,
});
