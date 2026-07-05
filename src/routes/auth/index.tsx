import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { loginSchema, type LoginInput } from "@/features/auth/validation";
import { signInWithPassword } from "@/features/auth/auth-service";
import { mapAuthError } from "@/features/auth/errors";
import { useAuth } from "@/features/auth/auth-context";
import { toSafeInternalPath } from "@/lib/security/redirect";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

const searchSchema = z.object({
  redirect: z.string().optional(),
  reason: z.enum(["expired", "unauthorized"]).optional(),
});

export const Route = createFileRoute("/auth/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · SpartaFlow Hub" },
      { name: "description", content: "Sign in to SpartaFlow Hub." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, reason } = useSearch({ from: "/auth/" });
  const navigate = useNavigate();
  const { isAuthenticated, initialized } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  // Same-origin path only — never trust the raw `redirect` param (open-redirect).
  const safeRedirect = toSafeInternalPath(redirect);

  // If already signed in, bounce to intended destination.
  useEffect(() => {
    if (initialized && isAuthenticated) {
      void navigate({ to: safeRedirect, replace: true });
    }
  }, [initialized, isAuthenticated, navigate, safeRedirect]);

  const onSubmit = async (values: LoginInput) => {
    setSubmitError(null);
    try {
      await signInWithPassword(values.email, values.password);
      toast.success("Welcome back");
      void navigate({ to: safeRedirect, replace: true });
    } catch (err) {
      setSubmitError(mapAuthError(err));
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      description="Use your work email and password to access SpartaFlow Hub."
      footer={
        <span>
          Need access?{" "}
          <span className="text-foreground">Ask HR or an administrator to invite you.</span>
        </span>
      }
    >
      {reason === "expired" ? (
        <Alert variant="default" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>Your session expired. Please sign in again.</AlertDescription>
        </Alert>
      ) : null}
      {reason === "unauthorized" ? (
        <Alert variant="default" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>Sign in to access that page.</AlertDescription>
        </Alert>
      ) : null}

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/auth/forgot-password"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
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
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={form.watch("remember") ?? true}
            onCheckedChange={(v) => form.setValue("remember", !!v)}
          />
          <span>Remember me on this device</span>
        </label>

        {submitError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
