import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/features/notifications/components/notification-center";

export const Route = createFileRoute("/_authenticated/app/notifications/")({
  head: () => ({
    meta: [{ title: "Notifications · SpartaFlow Hub" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Inbox"
        title="Notification center"
        description="Mentions, blockers, reminders and team alerts — all in one place."
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/notifications/preferences">Preferences</Link>
          </Button>
        }
      />
      <NotificationCenter />
    </AppShell>
  );
}
