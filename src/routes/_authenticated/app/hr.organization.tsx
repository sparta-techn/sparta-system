import { createFileRoute } from "@tanstack/react-router";
import { OrganizationStructure } from "@/features/hr/components/organization-structure";

export const Route = createFileRoute("/_authenticated/app/hr/organization")({
  head: () => ({ meta: [{ title: "Organization · SpartaFlow Hub" }] }),
  component: () => <OrganizationStructure />,
});
