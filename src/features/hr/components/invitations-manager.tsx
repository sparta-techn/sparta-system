import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Mail, MailX, RotateCw, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HrInvitation, InvitationStatus } from "../mock-data";
import {
  cancelInvitation,
  EXPIRY_OPTIONS,
  resendInvitation,
  updateSettings,
  useInvitations,
  useInvitationSettings,
} from "../invitations-store";
import { InvitationStatusBadge, RoleBadge } from "./badges";
import { EmptyState } from "./empty-state";
import { InviteEmployeeDialog } from "./invite-employee-dialog";

const TAB_ORDER: InvitationStatus[] = ["pending", "accepted", "expired", "cancelled"];
const TAB_LABEL: Record<InvitationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function InvitationsManager() {
  const [open, setOpen] = useState(false);
  const invitations = useInvitations();
  const settings = useInvitationSettings();

  const groups = useMemo(() => {
    const g: Record<InvitationStatus, HrInvitation[]> = {
      pending: [],
      accepted: [],
      expired: [],
      cancelled: [],
    };
    for (const inv of invitations) g[inv.status].push(inv);
    return g;
  }, [invitations]);

  function handleResend(inv: HrInvitation) {
    resendInvitation(inv.id);
    toast.success("Invitation resent", { description: inv.email });
  }

  function handleCancel(inv: HrInvitation) {
    cancelInvitation(inv.id);
    toast.message("Invitation cancelled", { description: inv.email });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Manage outstanding and historical invitations.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <Label
              htmlFor="default-expiry"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Expire after
            </Label>
            <Select
              value={String(settings.expiryDays)}
              onValueChange={(v) => {
                updateSettings({ expiryDays: Number(v) });
                toast.success("Default expiry updated", { description: `${v} days` });
              }}
            >
              <SelectTrigger id="default-expiry" className="w-28">
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
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Mail className="size-4" /> Invite employee
          </Button>
        </div>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          {TAB_ORDER.map((key) => (
            <TabsTrigger key={key} value={key}>
              {TAB_LABEL[key]} ({groups[key].length})
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_ORDER.map((key) => (
          <TabsContent key={key} value={key} className="mt-3">
            <Card>
              {groups[key].length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No invitations" icon={MailX} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Invited</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups[key].map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">
                            {i.email}
                            {i.name ? (
                              <span className="ml-1 text-xs text-muted-foreground">({i.name})</span>
                            ) : null}
                          </TableCell>
                          <TableCell>{i.department}</TableCell>
                          <TableCell>
                            <RoleBadge role={i.role} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(i.invitedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(i.expiresAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <InvitationStatusBadge status={i.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {i.status === "pending" || i.status === "expired" ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => handleResend(i)}
                                >
                                  <RotateCw className="size-3.5" /> Resend
                                </Button>
                                {i.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1 text-destructive hover:text-destructive"
                                    onClick={() => handleCancel(i)}
                                  >
                                    <X className="size-3.5" /> Cancel
                                  </Button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <InviteEmployeeDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
