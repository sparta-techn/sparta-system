import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";

import type { HrEmployee } from "../mock-data";
import { hrQueries } from "../queries";
import { useManagedEmployees } from "../employees-store";

/** Columns exported for the employee directory, in order. */
const EXPORT_COLUMNS: CsvColumn<HrEmployee>[] = [
  { header: "Name", value: (e) => e.name },
  { header: "Email", value: (e) => e.email },
  { header: "Phone", value: (e) => e.phone },
  { header: "Job title", value: (e) => e.jobTitle },
  { header: "Department", value: (e) => e.department },
  { header: "Team", value: (e) => e.team },
  { header: "Role", value: (e) => e.role },
  { header: "Status", value: (e) => e.status },
  { header: "Employment type", value: (e) => e.employmentType },
  { header: "Work mode", value: (e) => e.workMode },
  { header: "Location", value: (e) => e.location },
  { header: "Timezone", value: (e) => e.timezone },
  { header: "Joined", value: (e) => e.joinedAt },
];

/**
 * Exports the live employee directory (fetched list + local management overlay,
 * matching what the Employees tab shows) to a CSV download. Replaces the former
 * inert "Export" button in the HR workspace header.
 */
export function ExportEmployeesButton() {
  const { data: baseEmployees = [], isLoading, isError } = useQuery(hrQueries.employees());
  const employees = useManagedEmployees(baseEmployees);

  const handleExport = () => {
    if (employees.length === 0) {
      toast.info("No employees to export");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`employees-${stamp}.csv`, toCsv(employees, EXPORT_COLUMNS));
    toast.success(`Exported ${employees.length} employee${employees.length === 1 ? "" : "s"}`);
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isLoading || isError}
      title="Export the employee directory as a CSV file"
    >
      <Download className="mr-2 size-4" aria-hidden />
      Export
    </Button>
  );
}
