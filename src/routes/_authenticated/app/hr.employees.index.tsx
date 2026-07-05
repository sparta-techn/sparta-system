import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDirectory } from "@/features/hr/components/employee-directory";

export const Route = createFileRoute("/_authenticated/app/hr/employees/")({
  head: () => ({ meta: [{ title: "Employees · SpartaFlow Hub" }] }),
  component: () => <EmployeeDirectory />,
});
