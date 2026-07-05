import { createFileRoute } from "@tanstack/react-router";
import { InvitationsManager } from "@/features/hr/components/invitations-manager";

export const Route = createFileRoute("/_authenticated/app/hr/invitations")({
  head: () => ({ meta: [{ title: "Invitations · SpartaFlow Hub" }] }),
  component: () => <InvitationsManager />,
});
