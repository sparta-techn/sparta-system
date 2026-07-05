import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({
    meta: [
      { title: "Access denied · SpartaFlow Hub" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
          You don't have access
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role doesn't allow access to this page. If you think this is a mistake, contact
          HR or your administrator.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => router.history.back()}>
            Go back
          </Button>
          <Button asChild>
            <Link to="/app">Return to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
