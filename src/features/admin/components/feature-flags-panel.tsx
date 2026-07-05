import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { setFeatureFlag, useFeatureFlags } from "../system-store";

export function FeatureFlagsPanel() {
  const flags = useFeatureFlags();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Feature flags</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {flags.map((flag) => (
            <li key={flag.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{flag.label}</p>
                  <Badge variant={flag.enabled ? "default" : "outline"}>
                    {flag.enabled ? "On" : "Off"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{flag.description}</p>
                <code className="text-[11px] text-muted-foreground">{flag.key}</code>
              </div>
              <Switch
                checked={flag.enabled}
                onCheckedChange={(v) => {
                  setFeatureFlag(flag.key, v);
                  toast.success(`${flag.label} ${v ? "enabled" : "disabled"}`);
                }}
                aria-label={`Toggle ${flag.label}`}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
