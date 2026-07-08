import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SpartaFlow Hub" },
      {
        name: "description",
        content:
          "SpartaFlow Hub — the operating system for a remote software team. Internal platform, access by invitation only.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { initialized, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialized && isAuthenticated) {
      void navigate({ to: "/app", replace: true });
    }
  }, [initialized, isAuthenticated, navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-primary/10 via-background to-background px-6 py-12">
      <div className="max-w-xl text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Workflow className="size-6" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          SpartaFlow Hub
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          The internal operating system for our remote team. Access is by invitation only — if you
          don't have one yet, ask HR or your administrator.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Sign in <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
