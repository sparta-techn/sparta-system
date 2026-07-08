import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { acceptInvitationSchema, type AcceptInvitationInput } from "@/features/auth/validation";
import { updatePassword } from "@/features/auth/auth-service";
import { mapAuthError } from "@/features/auth/errors";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/auth/accept-invitation")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accept your invitation · SpartaFlow Hub" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [inviteeEmail, setInviteeEmail] = useState<string | null>(null);

  const form = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      fullName: "",
      jobTitle: "",
      password: "",
      confirm: "",
      acceptPolicies: false as unknown as true,
    },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setLinkError(
          "This invitation link is invalid or has expired. Ask HR or an administrator to resend it.",
        );
      } else {
        setInviteeEmail(data.session.user.email ?? null);
        const meta = data.session.user.user_metadata as
          | { full_name?: string; name?: string }
          | undefined;
        const guessedName = meta?.full_name || meta?.name;
        if (guessedName) form.setValue("fullName", guessedName);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: AcceptInvitationInput) => {
    setSubmitError(null);
    try {
      // Set the password and persist the completed profile + policy acceptance
      // onto the auth user's metadata (the profile row syncs from this).
      await updatePassword(values.password, {
        full_name: values.fullName,
        ...(values.jobTitle ? { job_title: values.jobTitle } : {}),
        policies_accepted: true,
        policies_accepted_at: new Date().toISOString(),
      });
      setSuccess(true);
      setTimeout(() => void navigate({ to: "/app", replace: true }), 1200);
    } catch (err) {
      setSubmitError(mapAuthError(err));
    }
  };

  if (checking) {
    return (
      <AuthLayout title="Verifying invitation…">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> One moment
        </div>
      </AuthLayout>
    );
  }

  if (linkError) {
    return (
      <AuthLayout
        title="Invitation invalid"
        description={linkError}
        footer={
          <Link to="/auth" className="hover:text-foreground">
            Go to sign in
          </Link>
        }
      >
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Your invitation may have expired or already been used.
          </AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="You're all set">
        <div className="rounded-lg border border-success/30 bg-success-soft/40 p-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 text-success" />
            <div>
              <p className="font-medium">Account ready. Redirecting you in…</p>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const pw = form.watch("password");

  return (
    <AuthLayout
      title="Welcome to SpartaFlow Hub"
      description={
        inviteeEmail
          ? `Finish setting up the account for ${inviteeEmail}.`
          : "Finish setting up your account."
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            autoFocus
            aria-invalid={!!form.formState.errors.fullName}
            {...form.register("fullName")}
          />
          {form.formState.errors.fullName ? (
            <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="jobTitle">
            Job title <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="jobTitle"
            type="text"
            autoComplete="organization-title"
            placeholder="e.g. Senior Engineer"
            aria-invalid={!!form.formState.errors.jobTitle}
            {...form.register("jobTitle")}
          />
          {form.formState.errors.jobTitle ? (
            <p className="text-xs text-destructive">{form.formState.errors.jobTitle.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Create a password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <Controller
              control={form.control}
              name="acceptPolicies"
              render={({ field }) => (
                <Checkbox
                  id="acceptPolicies"
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={!!form.formState.errors.acceptPolicies}
                />
              )}
            />
            <Label htmlFor="acceptPolicies" className="text-sm font-normal leading-snug">
              I have read and accept the{" "}
              <a
                href="/legal/terms"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Terms of Service
              </a>
              ,{" "}
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="/legal/code-of-conduct"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Code of Conduct
              </a>
              .
            </Label>
          </div>
          {form.formState.errors.acceptPolicies ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.acceptPolicies.message}
            </p>
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
              <Loader2 className="size-4 animate-spin" /> Activating account…
            </>
          ) : (
            "Activate account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
