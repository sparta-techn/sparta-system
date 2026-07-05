import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/session-expired")({
  head: () => ({
    meta: [
      { title: "Session expired · SpartaFlow Hub" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SessionExpiredPage,
});

function SessionExpiredPage() {
  return (
    <AuthLayout
      title="Your session expired"
      description="For your security, you've been signed out due to inactivity. Sign in again to continue."
    >
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Clock className="mt-0.5 size-4" />
          <p>Sessions automatically expire after a period of inactivity.</p>
        </div>
      </div>
      <div className="mt-4">
        <Button asChild className="w-full">
          <Link to="/auth" search={{ reason: "expired" }}>
            Sign in again
          </Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
