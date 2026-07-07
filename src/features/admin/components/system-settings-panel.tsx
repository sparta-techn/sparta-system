import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSettings, useSystemSettings } from "../system-store";
import type { SystemSettings } from "../types";

/**
 * The platform/security slice of system settings edited here. Company-identity
 * fields (name, timezone, support email, logo, working hours) live in the
 * Organization panel, which persists to `companies` via the org service.
 */
type PlatformSettings = Pick<
  SystemSettings,
  "sessionTimeoutMinutes" | "allowSignups" | "enforce2fa"
>;

export function SystemSettingsPanel() {
  const saved = useSystemSettings();
  const [form, setForm] = useState<PlatformSettings>({
    sessionTimeoutMinutes: saved.sessionTimeoutMinutes,
    allowSignups: saved.allowSignups,
    enforce2fa: saved.enforce2fa,
  });

  // Re-sync when the persisted settings change (e.g. another tab).
  useEffect(() => {
    setForm({
      sessionTimeoutMinutes: saved.sessionTimeoutMinutes,
      allowSignups: saved.allowSignups,
      enforce2fa: saved.enforce2fa,
    });
  }, [saved]);

  function set<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateSettings(form);
    toast.success("System settings saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">System settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sessionTimeout">Session timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min={5}
                max={1440}
                value={form.sessionTimeoutMinutes}
                onChange={(e) => set("sessionTimeoutMinutes", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <ToggleRow
              label="Allow self-service signups"
              description="When off, new members can only join by invitation."
              checked={form.allowSignups}
              onCheckedChange={(v) => set("allowSignups", v)}
            />
            <ToggleRow
              label="Enforce two-factor authentication"
              description="Require 2FA for every member org-wide."
              checked={form.enforce2fa}
              onCheckedChange={(v) => set("enforce2fa", v)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
