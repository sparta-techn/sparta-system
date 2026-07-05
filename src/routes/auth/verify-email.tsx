import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/verify-email")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Verify your email · SpartaFlow Hub" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const [state, setState] = useState<"checking" | "verified" | "pending">("checking");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const confirmed = !!data.user?.email_confirmed_at;
      setState(confirmed ? "verified" : "pending");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return (
      <AuthLayout title="Checking your email status…">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> One moment
        </div>
      </AuthLayout>
    );
  }

  if (state === "verified") {
    return (
      <AuthLayout
        title="Email verified"
        description="Your account is fully active. You can sign in any time."
        footer={
          <Link to="/auth" className="hover:text-foreground">
            Go to sign in
          </Link>
        }
      >
        <div className="rounded-lg border border-success/30 bg-success-soft/40 p-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 text-success" />
            <p>You're verified — welcome aboard.</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      description="We sent a confirmation link to your inbox. Click it to finish setting up your account."
      footer={
        <Link to="/auth" className="hover:text-foreground">
          Back to sign in
        </Link>
      }
    >
      <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 text-warning" />
          <div>
            <p className="font-medium">Confirmation pending</p>
            <p className="mt-1 text-muted-foreground">
              Didn't get the email? Check spam, or ask your administrator to resend the invitation.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
