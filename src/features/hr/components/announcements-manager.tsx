import { useState } from "react";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { announcements, departments } from "../mock-data";
import { EmptyState } from "./empty-state";

export function AnnouncementsManager() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("everyone");
  const [audienceLabel, setAudienceLabel] = useState("Everyone");
  const [when, setWhen] = useState("now");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body) return;
    toast.success(when === "now" ? "Announcement sent" : "Announcement scheduled", {
      description: `${audienceLabel} · ${title}`,
    });
    setTitle("");
    setBody("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="an-title">Title</Label>
              <Input
                id="an-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="an-body">Body</Label>
              <Textarea
                id="an-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select
                  value={audience}
                  onValueChange={(v) => {
                    setAudience(v);
                    setAudienceLabel(v === "everyone" ? "Everyone" : "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  {audience === "everyone"
                    ? "Scope"
                    : audience === "department"
                      ? "Department"
                      : audience === "team"
                        ? "Team"
                        : "Role"}
                </Label>
                {audience === "department" ? (
                  <Select value={audienceLabel} onValueChange={setAudienceLabel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : audience === "role" ? (
                  <Select value={audienceLabel} onValueChange={setAudienceLabel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Employee", "Team Lead", "Manager", "HR", "Contractors"].map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : audience === "team" ? (
                  <Input
                    value={audienceLabel}
                    onChange={(e) => setAudienceLabel(e.target.value)}
                    placeholder="Team name"
                  />
                ) : (
                  <Input value="All employees" disabled />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>When</Label>
              <Select value={when} onValueChange={setWhen}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">Send now</SelectItem>
                  <SelectItem value="later">Schedule for later</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline">
                Save draft
              </Button>
              <Button type="submit">{when === "now" ? "Send" : "Schedule"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <EmptyState title="No announcements yet" icon={Megaphone} />
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{a.title}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline">{a.audienceLabel}</Badge>
                      <Badge
                        variant={
                          a.status === "sent"
                            ? "default"
                            : a.status === "scheduled"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(a.scheduledFor).toLocaleString()} · {a.acknowledgements}/{a.reach}{" "}
                    acknowledged
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
