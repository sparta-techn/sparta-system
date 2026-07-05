/**
 * AI provider settings feature — barrel.
 *
 * A Settings page to configure OpenAI / Anthropic / Gemini (API key, model,
 * temperature, max tokens, system prompt), with validation and obfuscated,
 * non-exposed local key storage. See `docs/AI_PROVIDER_SETTINGS.md`.
 */

// Components
export { AISettingsPage } from "./components/ai-settings-page";
export { ProviderForm } from "./components/provider-form";
export { ApiKeyField } from "./components/api-key-field";

// Hooks
export { useAISettings } from "./hooks/use-ai-settings";
export type { UseAISettings } from "./hooks/use-ai-settings";

// Config store (non-secret)
export {
  useAISettingsState,
  getConfig,
  getActiveProvider,
  setActiveProvider,
  saveConfig,
  resetConfig,
} from "./store";

// Secret status (never the key itself)
export { useSecretStatus, hasApiKey } from "./secure-store";

// Effective config (non-UI; returns the real key for programmatic use)
export { getEffectiveConfig } from "./effective-config";
export type { EffectiveProviderConfig } from "./effective-config";

// Provider metadata & validation
export { PROVIDER_META, CONFIGURABLE_PROVIDERS, modelsFor, defaultConfig } from "./provider-meta";
export { providerConfigSchema, apiKeySchema, validateApiKey } from "./validation";
export type { ProviderConfigFormValues } from "./validation";

// Types
export type {
  ConfigurableProviderId,
  ProviderConfig,
  AISettingsState,
  SecretStatus,
} from "./types";
