import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { companyRepository } from "@/repositories/organization";
import type { CompanyUpdate } from "@/services/organization";

import { orgQueries } from "../organization-queries";
import { TIMEZONE_OPTIONS } from "../system-store";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The editable slice of a company, with UI-friendly (non-null) defaults. */
interface OrgForm {
  name: string;
  legal_name: string;
  timezone: string;
  logo_url: string;
  support_email: string;
  work_start_time: string;
  work_end_time: string;
  working_days: string[];
}

const EMPTY_FORM: OrgForm = {
  name: "",
  legal_name: "",
  timezone: "UTC",
  logo_url: "",
  support_email: "",
  work_start_time: "09:00",
  work_end_time: "17:00",
  working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

export function OrganizationSettingsPanel() {
  const qc = useQueryClient();
  const { data: company, isLoading } = useQuery(orgQueries.company());
  const [form, setForm] = useState<OrgForm>(EMPTY_FORM);

  // Hydrate the form from the loaded company (and re-sync on refetch).
  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name,
      legal_name: company.legal_name ?? "",
      timezone: company.timezone,
      logo_url: company.logo_url ?? "",
      support_email: company.support_email ?? "",
      work_start_time: company.work_start_time ?? "09:00",
      work_end_time: company.work_end_time ?? "17:00",
      working_days: company.working_days ?? [],
    });
  }, [company]);

  const mutation = useMutation({
    mutationFn: (patch: CompanyUpdate) => {
      if (!company) throw new Error("No organization to update.");
      return companyRepository.update(company.id, patch);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgQueries.company().queryKey });
      toast.success("Organization settings saved");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't save organization settings.");
    },
  });

  function set<K extends keyof OrgForm>(key: K, value: OrgForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      working_days: f.working_days.includes(day)
        ? f.working_days.filter((d) => d !== day)
        : [...f.working_days, day],
    }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      name: form.name.trim(),
      legal_name: form.legal_name.trim() || null,
      timezone: form.timezone,
      logo_url: form.logo_url.trim() || null,
      support_email: form.support_email.trim() || null,
      work_start_time: form.work_start_time || null,
      work_end_time: form.work_end_time || null,
      working_days: form.working_days,
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading organization…
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No organization found. Complete the bootstrap flow to create one.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Organization</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Company name</Label>
              <Input
                id="org-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-legal">Legal name</Label>
              <Input
                id="org-legal"
                value={form.legal_name}
                onChange={(e) => set("legal_name", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-tz">Time zone</Label>
              <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
                <SelectTrigger id="org-tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-support">Support email</Label>
              <Input
                id="org-support"
                type="email"
                value={form.support_email}
                onChange={(e) => set("support_email", e.target.value)}
                placeholder="support@acme.com"
              />
            </div>
          </div>

          {/* Logo — plain URL for now (Storage bucket out of MVP scope). */}
          <div className="space-y-1.5">
            <Label htmlFor="org-logo">Company logo URL</Label>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="Company logo preview"
                  className="size-10 rounded border object-contain"
                />
              ) : (
                <div className="grid size-10 place-items-center rounded border bg-muted text-xs text-muted-foreground">
                  Logo
                </div>
              )}
              <Input
                id="org-logo"
                value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://…/logo.png"
                className="flex-1"
              />
            </div>
          </div>

          {/* Working hours */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Working hours</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-start">Start</Label>
                <Input
                  id="org-start"
                  type="time"
                  value={form.work_start_time}
                  onChange={(e) => set("work_start_time", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-end">End</Label>
                <Input
                  id="org-end"
                  type="time"
                  value={form.work_end_time}
                  onChange={(e) => set("work_end_time", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Working days</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = form.working_days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
