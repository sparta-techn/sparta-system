import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceSettingsPanel } from "@/features/projects/components/workspace-settings";

export const Route = createFileRoute("/_authenticated/app/projects/workspace")({
  head: () => ({ meta: [{ title: "Workspace settings · SpartaFlow Hub" }] }),
  component: () => <WorkspaceSettingsPanel />,
});
