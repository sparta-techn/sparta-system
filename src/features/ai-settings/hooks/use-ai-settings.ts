/**
 * useAISettings — small facade over the settings store + secret status for the
 * Settings page. Never surfaces raw keys (only masked previews via `secretStatus`).
 */
import { useAISettingsState, setActiveProvider } from "../store";
import { useSecretStatus } from "../secure-store";
import type { ConfigurableProviderId, SecretStatus } from "../types";

export interface UseAISettings {
  activeProvider: ConfigurableProviderId;
  setActiveProvider: (provider: ConfigurableProviderId) => void;
  secretStatus: Record<ConfigurableProviderId, SecretStatus>;
}

export function useAISettings(): UseAISettings {
  const activeProvider = useAISettingsState((s) => s.activeProvider);
  const secretStatus = useSecretStatus();
  return { activeProvider, setActiveProvider, secretStatus };
}
