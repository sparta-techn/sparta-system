/**
 * Zod validation for provider configuration and API keys. Mirrors the project's
 * form-validation convention (zod + react-hook-form).
 */

import { z } from "zod";
import { MODEL_CATALOG } from "@/ai/models";
import { PROVIDER_META } from "./provider-meta";
import type { ConfigurableProviderId } from "./types";

/** Validate an API key's shape for a provider (format only — never its value leaves). */
export function apiKeySchema(provider: ConfigurableProviderId) {
  const meta = PROVIDER_META[provider];
  return z
    .string()
    .trim()
    .min(1, "API key is required")
    .regex(meta.keyPattern, `That doesn't look like a valid ${meta.label} key (${meta.keyHint})`);
}

/** Validate a key, returning an error message or `null` when valid. */
export function validateApiKey(provider: ConfigurableProviderId, key: string): string | null {
  const result = apiKeySchema(provider).safeParse(key);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid API key");
}

/** Build the config form schema for a provider (model, temperature, tokens, prompt). */
export function providerConfigSchema(provider: ConfigurableProviderId) {
  const models = MODEL_CATALOG[provider];
  const modelIds = models.map((m) => m.id) as [string, ...string[]];
  const maxOutputAll = Math.max(...models.map((m) => m.maxOutputTokens), 1);
  const meta = PROVIDER_META[provider];

  return z
    .object({
      model: z.enum(modelIds, { message: "Choose a model" }),
      temperature: z.number().min(0, "Min 0").max(2, "Max 2"),
      maxTokens: z
        .number({ message: "Enter a number" })
        .int("Whole numbers only")
        .min(1, "Min 1")
        .max(maxOutputAll, `Max ${maxOutputAll}`),
      systemPrompt: z.string().max(8000, "Keep under 8000 characters"),
    })
    .superRefine((val, ctx) => {
      const model = models.find((m) => m.id === val.model);
      if (model && val.maxTokens > model.maxOutputTokens) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxTokens"],
          message: `${model.label} supports up to ${model.maxOutputTokens} output tokens`,
        });
      }
      if (val.temperature > meta.maxTemperature) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["temperature"],
          message: `${meta.label} accepts temperature up to ${meta.maxTemperature}`,
        });
      }
    });
}

export type ProviderConfigFormValues = z.infer<ReturnType<typeof providerConfigSchema>>;
