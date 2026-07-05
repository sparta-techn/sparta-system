/**
 * useIntegration — single-provider view + settings schema access.
 *
 * Built on {@link useIntegrations} so it shares the same reactive subscription.
 * Returns the one provider's metadata + status, plus a helper to fetch its
 * settings schema for the Admin form.
 */

import { useCallback, useMemo } from "react";

import type { IntegrationId, SettingsSchema } from "../types";
import { getSettingsManager } from "../services/container";
import { useIntegrations, type IntegrationView } from "./use-integrations";

export interface UseIntegration {
  integration: IntegrationView | undefined;
  loadSettingsSchema: () => Promise<SettingsSchema>;
  refresh: () => Promise<void>;
}

export function useIntegration(id: IntegrationId): UseIntegration {
  const { integrations, refresh } = useIntegrations();

  const integration = useMemo(
    () => integrations.find((i) => i.metadata.id === id),
    [integrations, id],
  );

  const loadSettingsSchema = useCallback(() => getSettingsManager().schema(id), [id]);

  return { integration, loadSettingsSchema, refresh };
}
