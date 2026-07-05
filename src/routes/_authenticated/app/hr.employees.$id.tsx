import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeProfile } from "@/features/hr/components/employee-profile";
import { hrQueries } from "@/features/hr/queries";
import { useManagedEmployees } from "@/features/hr/employees-store";

export const Route = createFileRoute("/_authenticated/app/hr/employees/$id")({
  head: () => ({ meta: [{ title: "Employee · SpartaFlow Hub" }] }),
  component: EmployeeProfilePage,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Employee not found.</p>,
});

function EmployeeProfilePage() {
  const { id } = Route.useParams();
  const { data: baseEmployees = [], isLoading, isError } = useQuery(hrQueries.employees());
  // Include soft-deleted so a removed employee's profile is still reachable.
  const employees = useManagedEmployees(baseEmployees, { includeDeleted: true });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError)
    return (
      <p className="text-sm text-destructive">Couldn’t load this employee. Please try again.</p>
    );
  const employee = employees.find((e) => e.id === id);
  if (!employee) throw notFound();

  return (
    <div className="space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
        <Link to="/app/hr/employees">
          <ChevronLeft className="size-4" /> Back to directory
        </Link>
      </Button>
      <EmployeeProfile employee={employee} />
    </div>
  );
}
