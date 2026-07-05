import { Outlet, createFileRoute } from "@tanstack/react-router";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/dependencies")({
  staticData: routeGuard({ permissions: ["projects.read"] }),
  component: () => <Outlet />,
});
