import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/validation";
import { requestPasswordReset } from "@/features/auth/auth-service";
import { mapAuthError } from "@/features/auth/errors";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password · SpartaFlow Hub" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    setSubmitError(null);
    try {
      await requestPasswordReset(email);
      // Always show success — do not reveal whether the account exists.
      setSent(true);
    } catch (err) {
      // Treat rate-limit and similar errors as user-visible; silence "user not found".
      const message = mapAuthError(err);
      if (/not found/i.test(message)) {
        setSent(true);
        return;
      }
      setSubmitError(message);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="Check your inbox"
        description="If that email is registered, we just sent a password reset link. It expires shortly for your security."
        footer={
          <Link to="/auth" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3" /> Back to sign in
          </Link>
        }
      >
        <div className="rounded-lg border border-success/30 bg-success-soft/40 p-4 text-sm text-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 text-success" />
            <div>
              <p className="font-medium">Reset link sent</p>
              <p className="mt-1 text-muted-foreground">
                Didn't see it? Check spam, or try again in a minute.
              </p>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password?"
      description="Enter your work email and we'll send you a reset link."
      footer={
        <Link to="/auth" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="you@company.com"
            aria-invalid={!!form.formState.errors.email}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
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
              <Loader2 className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
