import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NotificationPreferencesPanel } from "@/features/notifications/components/notification-preferences";

export const Route = createFileRoute("/_authenticated/app/notifications/preferences")({
  head: () => ({
    meta: [{ title: "Notification preferences · SpartaFlow Hub" }],
  }),
  component: NotificationPreferencesPage,
});

function NotificationPreferencesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Settings"
        title="Notification preferences"
        description="Pick the categories that matter and how they should reach you."
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/notifications">Back to inbox</Link>
          </Button>
        }
      />
      <NotificationPreferencesPanel />
    </AppShell>
  );
}
