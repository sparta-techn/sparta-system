import { createFileRoute } from "@tanstack/react-router";

import { RoleCreator } from "@/features/roles/components/role-editor";

/** Static segment — declared before `$id` so "/app/roles/new" never matches it. */
export const Route = createFileRoute("/_authenticated/app/roles/new")({
  head: () => ({ meta: [{ title: "New role · SpartaFlow Hub" }] }),
  component: RoleCreator,
});
