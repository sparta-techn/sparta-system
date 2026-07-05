import { createFileRoute } from "@tanstack/react-router";
import { TemplateList } from "@/features/projects/components/template-list";

export const Route = createFileRoute("/_authenticated/app/projects/templates")({
  head: () => ({ meta: [{ title: "Project templates · SpartaFlow Hub" }] }),
  component: () => <TemplateList />,
});
