import { createFileRoute } from "@tanstack/react-router";
import { ClientDetail } from "@/features/projects/components/client-views";

export const Route = createFileRoute("/_authenticated/app/projects/clients/$id")({
  head: () => ({ meta: [{ title: "Client · SpartaFlow Hub" }] }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { id } = Route.useParams();
  return <ClientDetail clientId={id} />;
}
