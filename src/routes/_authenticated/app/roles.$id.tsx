import { createFileRoute } from "@tanstack/react-router";

import { RoleEditor } from "@/features/roles/components/role-editor";

export const Route = createFileRoute("/_authenticated/app/roles/$id")({
  component: RoleEditorPage,
});

function RoleEditorPage() {
  const { id } = Route.useParams();
  return <RoleEditor roleId={id} />;
}
