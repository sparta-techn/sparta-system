/**
 * ProviderForm — non-secret configuration for one provider: model, temperature,
 * max tokens and an optional system prompt. Validated with zod
 * (`providerConfigSchema`) via react-hook-form. Mount with `key={provider}` so
 * switching providers re-seeds the form from that provider's saved config.
 */
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { modelsFor, PROVIDER_META } from "../provider-meta";
import { providerConfigSchema, type ProviderConfigFormValues } from "../validation";
import { getConfig, saveConfig } from "../store";
import type { ConfigurableProviderId } from "../types";

interface ProviderFormProps {
  provider: ConfigurableProviderId;
}

export function ProviderForm({ provider }: ProviderFormProps) {
  const meta = PROVIDER_META[provider];
  const models = modelsFor(provider);
  const config = getConfig(provider);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProviderConfigFormValues>({
    resolver: zodResolver(providerConfigSchema(provider)),
    defaultValues: {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      systemPrompt: config.systemPrompt,
    },
  });

  const selectedModelId = watch("model");
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const temperature = watch("temperature");

  const onSubmit = (values: ProviderConfigFormValues) => {
    saveConfig(provider, values);
    toast.success(`${meta.label} settings saved`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Model */}
      <div className="space-y-1.5">
        <Label>Model</Label>
        <Controller
          control={control}
          name="model"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
      </div>

      {/* Temperature */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="font-mono text-sm text-muted-foreground">{temperature?.toFixed(1)}</span>
        </div>
        <Controller
          control={control}
          name="temperature"
          render={({ field }) => (
            <Slider
              min={0}
              max={meta.maxTemperature}
              step={0.1}
              value={[field.value]}
              onValueChange={(v) => field.onChange(v[0])}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          0 = deterministic, {meta.maxTemperature} = most creative.
        </p>
        {errors.temperature && (
          <p className="text-xs text-destructive">{errors.temperature.message}</p>
        )}
      </div>

      {/* Max tokens */}
      <div className="space-y-1.5">
        <Label htmlFor={`maxtokens-${provider}`}>Max Tokens</Label>
        <Input
          id={`maxtokens-${provider}`}
          type="number"
          min={1}
          max={selectedModel?.maxOutputTokens}
          {...register("maxTokens", { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">
          {selectedModel
            ? `Up to ${selectedModel.maxOutputTokens.toLocaleString()} for ${selectedModel.label}.`
            : "Maximum output tokens."}
        </p>
        {errors.maxTokens && <p className="text-xs text-destructive">{errors.maxTokens.message}</p>}
      </div>

      {/* System prompt */}
      <div className="space-y-1.5">
        <Label htmlFor={`sysprompt-${provider}`}>System Prompt</Label>
        <Textarea
          id={`sysprompt-${provider}`}
          rows={4}
          placeholder="Optional. Overrides the default assistant instructions for this provider."
          {...register("systemPrompt")}
        />
        {errors.systemPrompt && (
          <p className="text-xs text-destructive">{errors.systemPrompt.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
