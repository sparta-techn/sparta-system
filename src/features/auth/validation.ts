import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email")
  .max(254, "Email is too long");

/**
 * Strong password policy:
 *  - 10+ characters
 *  - at least one upper, one lower, one digit, one symbol
 *  Server-side: Have-I-Been-Pwned check is enforced by Supabase.
 */
export const strongPasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Password is too long")
  .refine((v) => /[a-z]/.test(v), "Add at least one lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Add at least one uppercase letter")
  .refine((v) => /\d/.test(v), "Add at least one number")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Add at least one symbol (e.g. !@#$%)");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
  remember: z.boolean(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const acceptInvitationSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120, "Name is too long"),
    jobTitle: z.string().trim().max(120, "Job title is too long").optional().or(z.literal("")),
    password: strongPasswordSchema,
    confirm: z.string().min(1, "Please confirm your password"),
    acceptPolicies: z.literal(true, {
      errorMap: () => ({ message: "You must accept the company policies to continue" }),
    }),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

/** Password strength score 0..4 for UI meter. */
export function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
