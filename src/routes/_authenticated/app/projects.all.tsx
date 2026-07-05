import { createFileRoute } from "@tanstack/react-router";
import { ProjectList } from "@/features/projects/components/project-list";

export const Route = createFileRoute("/_authenticated/app/projects/all")({
  head: () => ({ meta: [{ title: "All projects · SpartaFlow Hub" }] }),
  component: () => <ProjectList />,
});
