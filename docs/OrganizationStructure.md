# Organization Structure

Defines departments, teams, and the reporting hierarchy.

## Departments
Curated list (`departments` in mock data): Engineering, Design, Product, Data, QA, DevOps, Marketing, People Ops, Finance.

Each department card displays headcount and the inferred department head (first manager/lead in the department).

## Teams
Teams roll up to a single department and carry a lead. `HrTeam` shape:
```ts
interface HrTeam {
  id: string;
  name: string;
  department: Department;
  leadId: string;
  memberCount: number;
}
```

## Reporting hierarchy
Rendered recursively from `employees`:
- Root nodes have `managerId === null` (typically Owner, Super Admin, HR Lead).
- Children are everyone whose `managerId` points at that node.
- Tree depth is unbounded; indent + left border per level.

## Managers vs Department Heads
- **Manager** — a person assigned to other employees' `managerId`. Operational reporting line.
- **Department Head** — declared per department. May or may not be a Manager. (Mock data picks the first manager/lead in each department; replace with explicit `department_heads` table in production.)

## Future backend contract
| Table | Notes |
|---|---|
| `departments` | id, name, head_employee_id |
| `teams` | id, name, department_id, lead_employee_id |
| `employees.manager_id` | self-FK, nullable |

The UI assumes acyclic relationships. Add a server-side check that rejects assignments creating a cycle before persisting.
