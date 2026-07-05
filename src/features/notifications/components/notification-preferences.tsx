import { BellRing, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";

import { listChannels } from "../channels";
import { fireDemoEvent } from "../mock-data";
import { preferences, usePreferences } from "../preferences";
import type { DeliveryChannel, PreferenceCategory } from "../types";
import { CATEGORY_LABEL } from "../ui";

const CATEGORY_HELP: Record<PreferenceCategory, string> = {
  attendance: "Check-ins, late warnings, team absences.",
  dependencies: "Assignments, blockers, comments, resolutions.",
  announcements: "Company and team-wide announcements.",
  reports: "Morning, midday and end-of-day reminders.",
  mentions: "When someone tags you in a comment.",
  system: "Account, security and platform updates.",
  tasks: "Task assignments, status changes, comments and sprints.",
  approvals: "Attendance and leave approvals.",
};

const CHANNEL_LABEL: Record<DeliveryChannel, string> = {
  in_app: "In-app",
  email: "Email",
  slack: "Slack",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  push: "Push notifications",
  sms: "SMS",
};

export function NotificationPreferencesPanel() {
  const prefs = usePreferences();
  const channels = listChannels();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4 text-primary" aria-hidden /> Categories
          </CardTitle>
          <CardDescription>
            Choose which kinds of activity show up in your in-app inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1">
          {(Object.keys(CATEGORY_LABEL) as PreferenceCategory[]).map((cat, i) => (
            <div key={cat}>
              {i > 0 ? <Separator className="my-1" /> : null}
              <div className="flex items-start justify-between gap-4 py-2">
                <div className="min-w-0">
                  <Label htmlFor={`cat-${cat}`} className="text-sm font-medium">
                    {CATEGORY_LABEL[cat]}
                  </Label>
                  <p className="text-xs text-muted-foreground">{CATEGORY_HELP[cat]}</p>
                </div>
                <Switch
                  id={`cat-${cat}`}
                  checked={prefs.categories[cat]}
                  onCheckedChange={(v) => preferences.setCategory(cat, v)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery channels</CardTitle>
          <CardDescription>
            In-app is live. Other channels plug into the same event bus once
            integrated.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1">
          {channels.map((ch, i) => (
            <div key={ch.id}>
              {i > 0 ? <Separator className="my-1" /> : null}
              <div className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`ch-${ch.id}`}
                      className="text-sm font-medium"
                    >
                      {CHANNEL_LABEL[ch.id]}
                    </Label>
                    {ch.enabled ? (
                      <StatusBadge tone="success" label="Live" size="sm" />
                    ) : (
                      <StatusBadge tone="neutral" label="Coming soon" size="sm" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ch.enabled
                      ? "Delivers to your in-app inbox."
                      : "Architecture-ready; will deliver when integrated."}
                  </p>
                </div>
                <Switch
                  id={`ch-${ch.id}`}
                  checked={prefs.channels[ch.id]}
                  disabled={!ch.enabled}
                  onCheckedChange={(v) => preferences.setChannel(ch.id, v)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiet hours</CardTitle>
          <CardDescription>
            During quiet hours, only critical notifications surface.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
          <div className="flex items-center gap-2">
            <Switch
              id="qh-enable"
              checked={!!prefs.quietHours?.enabled}
              onCheckedChange={(v) =>
                preferences.setQuietHours({
                  enabled: v,
                  start: prefs.quietHours?.start ?? "22:00",
                  end: prefs.quietHours?.end ?? "07:00",
                })
              }
            />
            <Label htmlFor="qh-enable" className="text-sm">
              Enable
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qh-start" className="text-xs">Start</Label>
            <Input
              id="qh-start"
              type="time"
              value={prefs.quietHours?.start ?? "22:00"}
              disabled={!prefs.quietHours?.enabled}
              onChange={(e) =>
                preferences.setQuietHours({
                  enabled: prefs.quietHours?.enabled ?? false,
                  start: e.target.value,
                  end: prefs.quietHours?.end ?? "07:00",
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qh-end" className="text-xs">End</Label>
            <Input
              id="qh-end"
              type="time"
              value={prefs.quietHours?.end ?? "07:00"}
              disabled={!prefs.quietHours?.enabled}
              onChange={(e) =>
                preferences.setQuietHours({
                  enabled: prefs.quietHours?.enabled ?? false,
                  start: prefs.quietHours?.start ?? "22:00",
                  end: e.target.value,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden /> Try the engine
          </CardTitle>
          <CardDescription>
            Fire mock events to see how the automation engine routes them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fireDemoEvent("mention")}>
            Simulate mention
          </Button>
          <Button variant="outline" size="sm" onClick={() => fireDemoEvent("overdue")}>
            Simulate overdue
          </Button>
          <Button variant="outline" size="sm" onClick={() => fireDemoEvent("resolved")}>
            Simulate resolved
          </Button>
          <Button variant="outline" size="sm" onClick={() => fireDemoEvent("announce")}>
            Simulate announcement
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => preferences.reset()}
          >
            Reset preferences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
