import { createFileRoute } from "@tanstack/react-router";
import { AnnouncementsManager } from "@/features/hr/components/announcements-manager";

export const Route = createFileRoute("/_authenticated/app/hr/announcements")({
  head: () => ({ meta: [{ title: "Announcements · SpartaFlow Hub" }] }),
  component: () => <AnnouncementsManager />,
});
