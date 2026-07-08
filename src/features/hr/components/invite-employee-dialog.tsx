import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Department, type EmployeeRole } from "../mock-data";
import { issueInvitation, EXPIRY_OPTIONS, useInvitationSettings } from "../invitations-store";
import { hrQueries } from "../queries";
import { getErrorMessage } from "@/lib/errors";

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "team_lead", label: "Team Lead" },
  { value: "manager", label: "Manager" },
  { value: "hr", label: "HR" },
];

export function InviteEmployeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const settings = useInvitationSettings();
  // Live, org-specific department list (Supabase-backed) — not a fixed sample.
  const { data: departments = [] } = useQuery(hrQueries.departments());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<Department>("" as Department);
  const [role, setRole] = useState<EmployeeRole>("employee");
  const [expiryDays, setExpiryDays] = useState<number>(settings.expiryDays);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the dialog opens; seed expiry from current default.
  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setDepartment("" as Department);
      setRole("employee");
      setExpiryDays(settings.expiryDays);
    }
  }, [open, settings.expiryDays]);

  // Default the department to the first live option once the list is available.
  useEffect(() => {
    if (open && departments.length > 0 && !departments.includes(department)) {
      setDepartment(departments[0] as Department);
    }
  }, [open, departments, department]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      // Real round trip: creates the auth user + profile + role + employee row
      // server-side and emails the setup link, then records the local invite.
      const invitation = await issueInvitation({ name, email, department, role, expiryDays });
      onOpenChange(false);
      toast.success("Invitation sent", {
        description: `${invitation.email} has ${expiryDays} days to accept.`,
      });
    } catch (err) {
      toast.error("Couldn't send invitation", { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite employee</DialogTitle>
          <DialogDescription>
            Create the employee record and send an invitation email with a secure setup link.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="River Song"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@spartaflow.dev"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-dept">Department</Label>
              <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
                <SelectTrigger id="invite-dept">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as EmployeeRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-expiry">Invitation expires after</Label>
            <Select value={String(expiryDays)} onValueChange={(v) => setExpiryDays(Number(v))}>
              <SelectTrigger id="invite-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
