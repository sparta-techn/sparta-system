import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { setMaintenance, useMaintenance } from "../system-store";

export function MaintenancePanel() {
  const maintenance = useMaintenance();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Maintenance mode</CardTitle>
        <Badge variant={maintenance.enabled ? "destructive" : "outline"}>
          {maintenance.enabled ? "Active" : "Off"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Enable maintenance mode</p>
              <p className="text-xs text-muted-foreground">
                Shows an app-wide banner to all members. Use during deploys or incidents.
              </p>
            </div>
          </div>
          <Switch
            checked={maintenance.enabled}
            onCheckedChange={(v) => {
              setMaintenance({ enabled: v });
              toast[v ? "message" : "success"](
                v ? "Maintenance mode enabled" : "Maintenance mode disabled",
              );
            }}
            aria-label="Toggle maintenance mode"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maint-message">Banner message</Label>
          <Textarea
            id="maint-message"
            rows={2}
            value={maintenance.message}
            onChange={(e) => setMaintenance({ message: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maint-end">Planned end (optional)</Label>
          <Input
            id="maint-end"
            type="datetime-local"
            value={maintenance.plannedEndAt ?? ""}
            onChange={(e) => setMaintenance({ plannedEndAt: e.target.value || null })}
            className="max-w-xs"
          />
        </div>

        {maintenance.enabled && maintenance.startedAt ? (
          <p className="text-xs text-muted-foreground">
            Active since {new Date(maintenance.startedAt).toLocaleString()}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
