import {
  CheckSquare,
  ClipboardList,
  FileText,
  GaugeCircle,
  Play,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { requiresMidday } from "@/features/hr/employment-type";

const ACTIONS: { label: string; icon: LucideIcon; primary?: boolean; midday?: boolean }[] = [
  { label: "Start work", icon: Play, primary: true },
  { label: "Submit check-in", icon: CheckSquare },
  { label: "Submit midday", icon: GaugeCircle, midday: true },
  { label: "Submit end report", icon: FileText },
  { label: "Create dependency", icon: Plus },
  { label: "View tasks", icon: ClipboardList },
];

export function QuickActions() {
  const { employmentType } = useAuth();
  // Part-time employees don't file a midday pulse — drop that shortcut for them.
  const actions = requiresMidday(employmentType) ? ACTIONS : ACTIONS.filter((a) => !a.midday);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
        <CardDescription>One-click jumps to your daily rituals.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            variant={a.primary ? "default" : "outline"}
            className="h-auto justify-start gap-2 py-2.5"
          >
            <a.icon className="size-4" /> {a.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
