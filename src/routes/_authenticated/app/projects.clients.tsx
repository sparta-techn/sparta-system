import { createFileRoute } from "@tanstack/react-router";
import { ClientList } from "@/features/projects/components/client-views";

export const Route = createFileRoute("/_authenticated/app/projects/clients")({
  head: () => ({ meta: [{ title: "Clients · SpartaFlow Hub" }] }),
  component: () => <ClientList />,
});
