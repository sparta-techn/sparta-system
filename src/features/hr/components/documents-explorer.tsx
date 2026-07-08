import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { documents, employeeById } from "../mock-data";
import { EmptyState } from "./empty-state";

const CATEGORIES = ["all", "contract", "nda", "id", "tax", "certificate", "performance"] as const;

export function DocumentsExplorer() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const filtered = useMemo(
    () =>
      documents.filter((d) => {
        if (cat !== "all" && d.category !== cat) return false;
        if (q && !d.name.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [q, cat],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search document name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "All categories" : c.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto gap-2"
          onClick={() =>
            toast.success("Upload coming soon", {
              description: "File pickers will be wired up once storage is connected.",
            })
          }
        >
          <Upload className="size-4" /> Upload document
        </Button>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No documents found" icon={FileText} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 30).map((d) => {
                  const e = employeeById(d.employeeId);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        {d.name}
                      </TableCell>
                      <TableCell className="text-sm">{e?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm uppercase">{d.category}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(d.uploadedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Math.round(d.sizeKb)} KB
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost">
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
