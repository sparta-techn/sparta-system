import { FileText, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeAvatar } from "@/features/hr/components/employee-avatar";
import { activityFor, filesFor, personById } from "../store";
import type { Project } from "../types";

export function ProjectFiles({ project }: { project: Project }) {
  const files = filesFor(project.id);
  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-base font-semibold">Files</h2>
          <p className="text-xs text-muted-foreground">{files.length} files attached</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Upload className="size-4" /> Upload
        </Button>
      </div>
      {files.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No files uploaded yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Uploaded by</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f) => {
              const emp = personById(f.uploadedBy);
              return (
                <TableRow key={f.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="text-sm">{f.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs uppercase text-muted-foreground">
                    {f.kind}
                  </TableCell>
                  <TableCell>
                    {emp ? (
                      <div className="flex items-center gap-2">
                        <EmployeeAvatar employee={emp} size={22} />
                        <span className="text-sm">{emp.name}</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(f.uploadedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {(f.size / 1024).toFixed(0)} KB
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export function ProjectActivity({ project }: { project: Project }) {
  const events = activityFor(project.id);
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-base font-semibold">Activity</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const emp = personById(e.actorId);
            return (
              <li key={e.id} className="flex items-start gap-3 border-l-2 border-muted pl-3">
                {emp ? <EmployeeAvatar employee={emp} size={28} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{emp?.name ?? "Someone"}</span> {e.summary}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export function ProjectReports({ project }: { project: Project }) {
  return (
    <Card className="p-6">
      <h2 className="mb-2 text-base font-semibold">Reports</h2>
      <p className="text-sm text-muted-foreground">
        Project reports roll up attendance, completion, and dependency throughput from team
        activity. Live reports for{" "}
        <span className="font-medium text-foreground">{project.name}</span> will appear here once
        tasks are connected in the next phase.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReportStub title="Weekly completion" desc="Tasks done per week vs. plan." />
        <ReportStub title="Dependency aging" desc="Avg. time to resolve blockers." />
        <ReportStub title="Member contribution" desc="Hours and tasks per member." />
      </div>
    </Card>
  );
}

function ReportStub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
