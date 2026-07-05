import { Outlet, createFileRoute } from "@tanstack/react-router";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/sprints")({
  staticData: routeGuard({ permissions: ["projects.read"] }),
  head: () => ({ meta: [{ title: "Sprints · SpartaFlow Hub" }] }),
  component: () => <Outlet />,
});
