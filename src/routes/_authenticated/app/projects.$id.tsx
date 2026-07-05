import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetail } from "@/features/projects/components/project-detail";

export const Route = createFileRoute("/_authenticated/app/projects/$id")({
  head: () => ({ meta: [{ title: "Project · SpartaFlow Hub" }] }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  return <ProjectDetail projectId={id} />;
}
