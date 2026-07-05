/**
 * ProviderStatusBadge — renders a {@link ProviderStatusSnapshot} as a Badge.
 *
 * Reuses the shared `ui/Badge`; maps the status tone onto a Badge variant so
 * status colouring stays consistent with the rest of the design system.
 */

import { Badge } from "@/components/ui/badge";
import { ProviderStatus, type ProviderStatusSnapshot, type StatusTone } from "../models";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const TONE_VARIANT: Record<StatusTone, BadgeVariant> = {
  success: "default",
  danger: "destructive",
  warning: "secondary",
  muted: "secondary",
  neutral: "outline",
};

interface ProviderStatusBadgeProps {
  status: ProviderStatusSnapshot;
}

export function ProviderStatusBadge({ status }: ProviderStatusBadgeProps) {
  // Rebuild a ProviderStatus to reuse its label/tone derivation (single source).
  const model = new ProviderStatus({
    integrationId: status.integrationId,
    state: status.state,
    accountCount: status.accountCount,
    lastCheckedAt: status.lastCheckedAt,
    latencyMs: status.latencyMs,
    message: status.message,
  });

  return <Badge variant={TONE_VARIANT[model.tone]}>{model.label}</Badge>;
}
