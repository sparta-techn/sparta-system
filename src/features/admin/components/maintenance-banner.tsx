import { AlertTriangle } from "lucide-react";

import { useMaintenance } from "../system-store";

/**
 * App-wide maintenance banner. Renders in the AppShell above page content
 * whenever maintenance mode is enabled from the Admin Console.
 */
export function MaintenanceBanner() {
  const maintenance = useMaintenance();
  if (!maintenance.enabled) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-medium">Maintenance mode</p>
        <p className="text-muted-foreground">{maintenance.message}</p>
        {maintenance.plannedEndAt ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Planned to end {new Date(maintenance.plannedEndAt).toLocaleString()}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
