import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import type { EmailOtpType } from "@supabase/supabase-js";

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

/**
 * Credentials a recovery link can carry, depending on GoTrue's flow:
 * - implicit: an `access_token` + `refresh_token` pair in the URL hash
 * - PKCE/OTP: a single-use `token_hash` in the query string or hash
 */
type RecoveryCredentials =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "otp"; tokenHash: string; type: EmailOtpType };

/**
 * Read the recovery token off the current URL. Runs synchronously before any
 * `await`. With `detectSessionInUrl` disabled (see supabase/client.ts) nothing
 * else consumes the hash, so we exchange the token ourselves here rather than
 * relying on Supabase to have implicitly established the recovery session.
 */
function readRecoveryCredentialsFromUrl(): RecoveryCredentials | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }

  const tokenHash = query.get("token_hash") ?? hash.get("token_hash");
  if (tokenHash) {
    const type = (query.get("type") ?? hash.get("type") ?? "recovery") as EmailOtpType;
    return { kind: "otp", tokenHash, type };
  }

  return null;
}

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

  useEffect(() => {
    let cancelled = false;
    // Read the recovery token synchronously, before any await.
    const recoveryCreds = readRecoveryCredentialsFromUrl();

    void (async () => {
      // Establish the recovery session explicitly from the link's token instead
      // of relying on the client's (now-disabled) detectSessionInUrl.
      if (recoveryCreds) {
        // Drop any existing local session first so the reset always applies to
        // the account named in the link, not whoever is currently signed in.
        await supabase.auth.signOut({ scope: "local" });

        const { error } =
          recoveryCreds.kind === "tokens"
            ? await supabase.auth.setSession({
                access_token: recoveryCreds.accessToken,
                refresh_token: recoveryCreds.refreshToken,
              })
            : await supabase.auth.verifyOtp({
                token_hash: recoveryCreds.tokenHash,
                type: recoveryCreds.type,
              });

        if (!cancelled && error) {
          setLinkError("This reset link is invalid or has expired. Request a new one to continue.");
          setChecking(false);
          return;
        }

        // Strip the token from the URL so it can't be reused or leak on refresh.
        if (typeof window !== "undefined") {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      // Confirm we actually hold a recovery session before showing the form.
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
