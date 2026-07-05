import { createFileRoute } from "@tanstack/react-router";
import { DocumentsExplorer } from "@/features/hr/components/documents-explorer";

export const Route = createFileRoute("/_authenticated/app/hr/documents")({
  head: () => ({ meta: [{ title: "Documents · SpartaFlow Hub" }] }),
  component: () => <DocumentsExplorer />,
});
