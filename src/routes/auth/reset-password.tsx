import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/validation";
import { updatePassword, signOut } from "@/features/auth/auth-service";
import { mapAuthError } from "@/features/auth/errors";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/auth/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password · SpartaFlow Hub" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  // The recovery link puts Supabase into a temporary recovery session.
  // Confirm we actually have a session before showing the form.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setLinkError("This reset link is invalid or has expired. Request a new one to continue.");
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (values: ResetPasswordInput) => {
    setSubmitError(null);
    try {
      await updatePassword(values.password);
      // Force a fresh login with the new password.
      await signOut();
      setSuccess(true);
      setTimeout(() => void navigate({ to: "/auth", replace: true }), 1800);
    } catch (err) {
      setSubmitError(mapAuthError(err));
    }
  };

  if (checking) {
    return (
      <AuthLayout title="Verifying link…">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> One moment
        </div>
      </AuthLayout>
    );
  }

  if (linkError) {
    return (
      <AuthLayout
        title="Link no longer valid"
        description={linkError}
        footer={
          <Link to="/auth/forgot-password" className="hover:text-foreground">
            Request a new link
          </Link>
        }
      >
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Ask for a fresh reset link to continue.</AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Password updated">
        <div className="rounded-lg border border-success/30 bg-success-soft/40 p-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 text-success" />
            <div>
              <p className="font-medium">You can now sign in with your new password.</p>
              <p className="mt-1 text-muted-foreground">Redirecting you to sign in…</p>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const pw = form.watch("password");

  return (
    <AuthLayout
      title="Set a new password"
      description="Choose a strong password you don't use anywhere else."
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              className="pr-10"
              aria-invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
          <PasswordStrength value={pw} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.confirm}
            {...form.register("confirm")}
          />
          {form.formState.errors.confirm ? (
            <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
          ) : null}
        </div>

        {submitError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
