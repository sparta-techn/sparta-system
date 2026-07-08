import { Bell, Download, Megaphone, UserPlus, Users, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACTIONS: { label: string; icon: LucideIcon; hint: string }[] = [
  { label: "Send reminder", icon: Bell, hint: "Nudge missing reports" },
  { label: "Create announcement", icon: Megaphone, hint: "Post company update" },
  { label: "Assign dependency", icon: Workflow, hint: "Route new blocker" },
  { label: "View team", icon: Users, hint: "Open team directory" },
  { label: "Invite member", icon: UserPlus, hint: "Send invitation" },
  { label: "Export attendance", icon: Download, hint: "CSV (placeholder)" },
];

export function ManagerQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
        <CardDescription>Common manager workflows in one click.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <Button
              key={a.label}
              variant="outline"
              className="h-auto justify-start gap-3 px-3 py-3 text-left"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <a.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {a.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{a.hint}</span>
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
