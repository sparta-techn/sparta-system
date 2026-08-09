/**
 * Past broadcasts, with per-recipient delivery status.
 *
 * Same UX contract as the rewards history table: a `failed` row surfaces its
 * captured error in a tooltip rather than leaving a silent gap, so "who didn't
 * get this and why" is answerable without opening the database.
 */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { getErrorMessage } from "@/lib/errors";

import type { GeneralEmailDelivery, GeneralEmailRecord } from "../general-email.functions";
import { generalEmailsHistoryQuery } from "../queries";

export function BroadcastHistory() {
  const query = useQuery(generalEmailsHistoryQuery());

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load sent messages"
        description={getErrorMessage(query.error)}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const emails = query.data ?? [];
  if (emails.length === 0) {
    return (
      <EmptyState
        title="No messages sent yet"
        description="Broadcasts you send to the team will appear here with their delivery status."
      />
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Sent by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <BroadcastRow key={email.id} email={email} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function BroadcastRow({ email }: { email: GeneralEmailRecord }) {
  const pending = email.recipientCount - email.sentCount - email.failedCount;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Collapsible>
          <div>{email.subject}</div>
          <CollapsibleTrigger className="group mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
            Per-recipient status
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 space-y-1.5 border-l border-border pl-3">
              {email.deliveries.map((delivery) => (
                <DeliveryRow key={delivery.employeeId} delivery={delivery} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </TableCell>
      <TableCell className="text-muted-foreground">{email.sentByName ?? "Unknown"}</TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(email.createdAt).toLocaleDateString([], {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </TableCell>
      <TableCell className="text-right tabular-nums">{email.recipientCount}</TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {email.sentCount > 0 ? (
            <Badge variant="outline" className="gap-1 text-success">
              <CheckCircle2 className="size-3" />
              {email.sentCount} sent
            </Badge>
          ) : null}
          {email.failedCount > 0 ? (
            <Badge variant="outline" className="gap-1 text-destructive">
              <AlertTriangle className="size-3" />
              {email.failedCount} failed
            </Badge>
          ) : null}
          {pending > 0 ? (
            <Badge variant="outline" className="gap-1 text-warning">
              <Clock className="size-3" />
              {pending} pending
            </Badge>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function DeliveryRow({ delivery }: { delivery: GeneralEmailDelivery }) {
  const label = (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-foreground">{delivery.employeeName}</span>
      {delivery.status === "sent" ? (
        <Badge variant="outline" className="h-5 text-success">
          sent
        </Badge>
      ) : delivery.status === "failed" ? (
        <Badge variant="outline" className="h-5 gap-1 text-destructive">
          <AlertTriangle className="size-3" />
          failed
        </Badge>
      ) : (
        <Badge variant="outline" className="h-5 text-warning">
          pending
        </Badge>
      )}
    </span>
  );

  // A failure always says why — hovering is the fastest route to the reason.
  if (delivery.status === "failed" && delivery.errorMessage) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{label}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{delivery.errorMessage}</TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return <li>{label}</li>;
}
