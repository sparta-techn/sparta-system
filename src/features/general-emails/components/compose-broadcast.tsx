/**
 * Broadcast composer — pick recipients, write the message, preview, send.
 *
 * The preview renders the REAL email shell in a sandboxed iframe, from the same
 * `renderGeneralEmail` the server sends, over the same sanitized body — so what
 * HR approves is what lands in the inbox. The client-side sanitization here is
 * for the preview only; the server sanitizes again before storing, and never
 * trusts this one.
 *
 * Sending is behind an explicit confirmation naming the audience ("Send to 12
 * employees"), because a broadcast cannot be recalled.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { getErrorMessage } from "@/lib/errors";
import { hrQueries } from "@/features/hr/queries";
import type { HrEmployee } from "@/features/hr/mock-data";

import { renderGeneralEmail } from "../general-email";
import { sendGeneralEmailFn } from "../general-email.functions";
import { generalEmailCompanyQuery, generalEmailKeys } from "../queries";
import { isEmptyHtml, sanitizeEmailHtml } from "../sanitize-html";
import { RichTextEditor } from "./rich-text-editor";

export function ComposeBroadcast() {
  const queryClient = useQueryClient();
  const employeesQuery = useQuery(hrQueries.employees());
  const companyQuery = useQuery(generalEmailCompanyQuery());

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const selectedEmployees = useMemo(
    () => employees.filter((e) => selected.has(e.id)),
    [employees, selected],
  );

  const cleanBody = useMemo(() => sanitizeEmailHtml(bodyHtml), [bodyHtml]);
  const bodyEmpty = isEmptyHtml(cleanBody);

  // The preview is rendered for the FIRST recipient, so the greeting is real
  // rather than a placeholder that differs from what anyone receives.
  const preview = useMemo(() => {
    if (bodyEmpty || !subject.trim()) return null;
    const company = companyQuery.data;
    return renderGeneralEmail({
      subject: subject.trim(),
      bodyHtml: cleanBody,
      employeeName: selectedEmployees[0]?.name ?? "there",
      company: {
        name: company?.name ?? "SpartaFlow",
        logoUrl: company?.logo_url ?? null,
        supportEmail: company?.support_email ?? null,
      },
    });
  }, [bodyEmpty, subject, cleanBody, companyQuery.data, selectedEmployees]);

  const allSelected = employees.length > 0 && selected.size === employees.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: () =>
      sendGeneralEmailFn({
        data: {
          subject: subject.trim(),
          bodyHtml: cleanBody,
          recipientEmployeeIds: [...selected],
        },
      }),
    onSuccess: (result) => {
      if (result.failed === 0) {
        toast.success(`Sent to ${result.sent} ${result.sent === 1 ? "employee" : "employees"}.`);
      } else {
        // Never report a partial send as a success — name the damage.
        toast.warning(
          `Sent to ${result.sent}, failed for ${result.failed}. See the history tab for which recipients failed and why.`,
        );
      }
      void queryClient.invalidateQueries({ queryKey: generalEmailKeys.history() });
      setConfirming(false);
      setSubject("");
      setBodyHtml("");
      setSelected(new Set());
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setConfirming(false);
    },
  });

  const canSend = subject.trim().length > 0 && !bodyEmpty && selected.size > 0;

  const audience =
    selectedEmployees.length === 1 ? selectedEmployees[0].name : `${selected.size} employees`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      {/* Recipients */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Recipients</Label>
            <Badge variant="outline">{selected.size} selected</Badge>
          </div>

          {employeesQuery.isPending ? (
            <ListSkeleton rows={6} />
          ) : employeesQuery.isError ? (
            <ErrorState
              title="Couldn't load employees"
              description={getErrorMessage(employeesQuery.error)}
              action={
                <Button variant="outline" onClick={() => employeesQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : employees.length === 0 ? (
            <EmptyState title="No employees" description="There is nobody to send a message to." />
          ) : (
            <>
              <label className="flex items-center gap-2.5 border-b border-border pb-2 text-sm font-medium">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                Select all ({employees.length})
              </label>
              <ScrollArea className="h-80">
                <div className="space-y-0.5 pr-3">
                  {employees.map((employee: HrEmployee) => (
                    <label
                      key={employee.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={selected.has(employee.id)}
                        onCheckedChange={() => toggle(employee.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{employee.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {employee.email}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* Compose + preview */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-subject">Subject</Label>
            <Input
              id="broadcast-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this message about?"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label id="broadcast-body-label">Message</Label>
            <RichTextEditor aria-labelledby="broadcast-body-label" onChange={setBodyHtml} />
            <p className="text-xs text-muted-foreground">
              Bold, italics, lists and links are kept. Other formatting is removed before sending.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Email preview</Label>
            <div className="h-80 overflow-hidden rounded-lg border border-border bg-muted/40">
              {preview ? (
                <iframe
                  title="Broadcast email preview"
                  sandbox=""
                  srcDoc={preview.html}
                  className="size-full"
                />
              ) : (
                <p className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
                  Add a subject and a message to see the preview.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled={!canSend} onClick={() => setConfirming(true)}>
              <Send /> Send to {selected.size || "…"}{" "}
              {selected.size === 1 ? "employee" : "employees"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirming} onOpenChange={(open) => !mutation.isPending && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send to {audience}?</DialogTitle>
            <DialogDescription>
              &ldquo;{subject.trim()}&rdquo; will be emailed{" "}
              {selectedEmployees.length === 1
                ? `to ${selectedEmployees[0].name}`
                : `to all ${selected.size} selected employees`}
              . An email cannot be recalled once sent.
            </DialogDescription>
          </DialogHeader>

          {selectedEmployees.length > 1 ? (
            <ScrollArea className="max-h-40 rounded-lg border border-border bg-muted/40 p-3">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {selectedEmployees.map((e) => (
                  <li key={e.id}>{e.name}</li>
                ))}
              </ul>
            </ScrollArea>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
