import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "../types";
import { createClient, deleteClient, updateClient, useProjectsState } from "../store";

export function ClientList() {
  const clients = useProjectsState((s) => s.clients);
  const projects = useProjectsState((s) => s.projects);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!q) return clients;
    const s = q.toLowerCase();
    return clients.filter(
      (c) =>
        c.company.toLowerCase().includes(s) ||
        c.contactPerson.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s),
    );
  }, [clients, q]);

  function projectCount(clientId: string) {
    return projects.filter((p) => p.clientId === clientId).length;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients"
            className="pl-8"
          />
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New client
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    to="/app/projects/clients/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span
                      className="grid size-8 place-items-center rounded-lg text-white font-medium"
                      style={{
                        background: `linear-gradient(135deg, hsl(${c.logoHue} 70% 45%), hsl(${(c.logoHue + 40) % 360} 70% 35%))`,
                      }}
                      aria-hidden
                    >
                      {c.company.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-medium">{c.company}</span>
                  </Link>
                </TableCell>
                <TableCell>{c.contactPerson}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                <TableCell className="text-right tabular-nums">{projectCount(c.id)}</TableCell>
                <TableCell className="text-right">
                  <ClientRowActions client={c} projectCount={projectCount(c.id)} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No clients match.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <ClientFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function ClientDetail({ clientId }: { clientId: string }) {
  const client = useProjectsState((s) => s.clients.find((c) => c.id === clientId) ?? null);
  const projects = useProjectsState((s) => s.projects.filter((p) => p.clientId === clientId));

  if (!client) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium">Client not found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <span
            className="grid size-14 place-items-center rounded-xl text-xl text-white font-semibold"
            style={{
              background: `linear-gradient(135deg, hsl(${client.logoHue} 70% 45%), hsl(${(client.logoHue + 40) % 360} 70% 35%))`,
            }}
          >
            {client.company.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold">{client.company}</h1>
            <p className="text-sm text-muted-foreground">
              {client.contactPerson} · {client.email} · {client.phone}
            </p>
            <p className="text-sm text-muted-foreground">{client.address}</p>
          </div>
          <ClientRowActions client={client} projectCount={projects.length} />
        </div>
        {client.notes ? (
          <p className="mt-4 rounded-md bg-muted/40 p-3 text-sm">{client.notes}</p>
        ) : null}
      </Card>

      <Card>
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Projects</h2>
          <p className="text-xs text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"} for this client
          </p>
        </div>
        {projects.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No projects linked yet.
          </div>
        ) : (
          <ul className="divide-y">
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/app/projects/$id"
                params={{ id: p.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <span className="text-lg" aria-hidden>
                  {p.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.key} · {p.progress}% complete
                  </p>
                </div>
              </Link>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Per-row Edit / Delete menu with confirmation. */
function ClientRowActions({ client, projectCount }: { client: Client; projectCount: number }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function runDelete() {
    setDeleting(true);
    try {
      await deleteClient(client.id);
      toast.success("Client deleted", { description: client.company });
      setConfirmOpen(false);
    } catch (err) {
      toast.error("Couldn't delete client", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${client.company}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit client</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {client.company} will be permanently deleted.
              {projectCount > 0
                ? ` ${projectCount} linked project${projectCount === 1 ? "" : "s"} will be unlinked (not deleted).`
                : ""}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void runDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Create/edit client form. When `client` is provided it edits that record;
 * otherwise it creates a new one. Persists to Supabase (awaited) before closing,
 * so RLS/validation failures surface as an error toast instead of a phantom row.
 */
function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client;
}) {
  const isEdit = Boolean(client);
  const [company, setCompany] = useState(client?.company ?? "");
  const [contactPerson, setContactPerson] = useState(client?.contactPerson ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [saving, setSaving] = useState(false);

  function reset() {
    setCompany(client?.company ?? "");
    setContactPerson(client?.contactPerson ?? "");
    setEmail(client?.email ?? "");
    setPhone(client?.phone ?? "");
    setAddress(client?.address ?? "");
    setNotes(client?.notes ?? "");
  }

  async function submit() {
    if (!company.trim() || saving) return;
    setSaving(true);
    const payload = {
      company: company.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
    };
    try {
      if (client) {
        await updateClient(client.id, payload);
        toast.success("Client updated", { description: payload.company });
      } else {
        await createClient(payload);
        toast.success("Client created", { description: payload.company });
      }
      onOpenChange(false);
      if (!client) reset();
    } catch (err) {
      toast.error(isEdit ? "Couldn't update client" : "Couldn't create client", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Company *</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Contact person</Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!company.trim() || saving}>
            {saving
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
